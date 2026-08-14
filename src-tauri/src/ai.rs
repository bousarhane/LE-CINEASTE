use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{env, path::PathBuf, process::{Command, Stdio}, thread, time::Duration};

use crate::models::{
    AiAnalysis, AiStatus, ExtractedCharacter, ExtractedEntities, ExtractedLocation,
    SceneDramaticAnalysis,
};

const OLLAMA_BASE: &str = "http://127.0.0.1:11434";
const RECOMMENDED_MODEL: &str = "qwen3:8b";

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())
}

fn pull_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(60 * 60))
        .build()
        .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
struct TagsResponse {
    #[serde(default)]
    models: Vec<TagModel>,
}

#[derive(Debug, Deserialize)]
struct TagModel {
    #[serde(default)]
    name: String,
    #[serde(default)]
    model: String,
}

#[derive(Debug, Deserialize)]
struct GenerateResponse {
    response: String,
}

fn vec_strings(value: &Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| text.trim().to_string()))
                .filter(|text| !text.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

async fn fetch_status() -> Result<AiStatus, String> {
    let result = client()?.get(format!("{OLLAMA_BASE}/api/tags")).send().await;

    match result {
        Ok(response) if response.status().is_success() => {
            let data: TagsResponse = response.json().await.map_err(|e| e.to_string())?;
            let models = data
                .models
                .into_iter()
                .filter_map(|m| {
                    let value = if m.name.is_empty() { m.model } else { m.name };
                    (!value.is_empty()).then_some(value)
                })
                .collect::<Vec<_>>();
            Ok(AiStatus {
                online: true,
                message: if models.is_empty() {
                    "Ollama متصل، لكن لا يوجد نموذج محلي مثبت.".into()
                } else {
                    "Ollama متصل محلياً.".into()
                },
                models,
            })
        }
        Ok(response) => Ok(AiStatus {
            online: false,
            models: vec![],
            message: format!("Ollama غير جاهز: {}", response.status()),
        }),
        Err(_) => Ok(AiStatus {
            online: false,
            models: vec![],
            message: "Ollama غير مشغل على الجهاز.".into(),
        }),
    }
}

fn ollama_executable() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
            let candidate = PathBuf::from(local_app_data)
                .join("Programs")
                .join("Ollama")
                .join("ollama.exe");
            if candidate.exists() {
                return candidate;
            }
        }
    }
    PathBuf::from("ollama")
}

fn spawn_ollama() -> Result<(), String> {
    let mut command = Command::new(ollama_executable());
    command.arg("serve").stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("تعذر تشغيل Ollama. تأكد من تثبيته على Windows: {e}"))
}

async fn generate(model: &str, prompt: &str, format: Option<Value>) -> Result<String, String> {
    if model.trim().is_empty() {
        return Err("لم يتم اختيار نموذج Ollama محلي.".into());
    }
    let mut body = json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
        "think": false,
        "keep_alive": "10m",
        "options": {
            "temperature": 0.15,
            "num_ctx": 32768
        }
    });
    if let Some(format) = format {
        body["format"] = format;
    }

    let response = client()?
        .post(format!("{OLLAMA_BASE}/api/generate"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("تعذر الاتصال بـ Ollama: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama أعاد خطأ {status}: {text}"));
    }

    let data: GenerateResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(data.response.trim().to_string())
}

#[tauri::command]
pub async fn ai_status() -> Result<AiStatus, String> {
    fetch_status().await
}

#[tauri::command]
pub async fn ai_start_ollama() -> Result<AiStatus, String> {
    let initial = fetch_status().await?;
    if initial.online {
        return Ok(initial);
    }

    spawn_ollama()?;
    for _ in 0..12 {
        thread::sleep(Duration::from_millis(500));
        let current = fetch_status().await?;
        if current.online {
            return Ok(current);
        }
    }

    Ok(AiStatus {
        online: false,
        models: vec![],
        message: "تم إرسال أمر تشغيل Ollama، لكنه لم يصبح جاهزاً بعد. أعد الفحص بعد لحظات.".into(),
    })
}

#[tauri::command]
pub async fn ai_pull_model(model: Option<String>) -> Result<AiStatus, String> {
    let model = model
        .unwrap_or_else(|| RECOMMENDED_MODEL.to_string())
        .trim()
        .to_string();
    if model.is_empty() {
        return Err("اسم النموذج فارغ.".into());
    }

    let status = fetch_status().await?;
    if !status.online {
        return Err("شغّل Ollama أولاً قبل تنزيل النموذج.".into());
    }

    let response = pull_client()?
        .post(format!("{OLLAMA_BASE}/api/pull"))
        .json(&json!({ "model": model, "stream": false }))
        .send()
        .await
        .map_err(|e| format!("تعذر تنزيل النموذج: {e}"))?;

    if !response.status().is_success() {
        let code = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("فشل تنزيل النموذج ({code}): {text}"));
    }

    fetch_status().await
}

#[tauri::command]
pub async fn ai_read_scene(
    model: String,
    scene_text: String,
    project_context: String,
    previous_scene_text: String,
    next_scene_text: String,
) -> Result<SceneDramaticAnalysis, String> {
    if scene_text.trim().is_empty() {
        return Err("المشهد الحالي فارغ.".into());
    }

    let prompt = format!(r#"
أنت قارئ درامي محترف للسيناريو، لا مؤلف بديل عن الكاتب.
اقرأ المشهد الحالي داخل سياق المشروع، وقدّم تشخيصاً درامياً عملياً فقط.
لا تخترع دوافع أو أحداثاً غير موجودة. إذا لم يسمح النص بحكم واضح، اكتب: "غير واضح من المشهد".
لا تعيد كتابة المشهد ولا تقترح حواراً بديلاً. فرّق بين ما هو موجود فعلاً وبين ما يحتاج الكاتب إلى اختباره.
اجعل كل خانة قصيرة ومحددة، والأسئلة موجهة للكاتب وليست أوامر.
أعد JSON فقط وفق المخطط المحدد.

سياق المشروع:
---
{}
---

المشهد السابق (إن وجد):
---
{}
---

المشهد الحالي:
---
{}
---

المشهد التالي (إن وجد):
---
{}
---
"#, project_context, previous_scene_text, scene_text, next_scene_text);

    let schema = json!({
        "type": "object",
        "properties": {
            "sceneFunction": {"type": "string"},
            "dramaticGoal": {"type": "string"},
            "characterDrive": {"type": "string"},
            "conflict": {"type": "string"},
            "stakes": {"type": "string"},
            "turningPoint": {"type": "string"},
            "change": {"type": "string"},
            "newInformation": {"type": "string"},
            "pacing": {"type": "string"},
            "dialogueReading": {"type": "string"},
            "visualReading": {"type": "string"},
            "continuity": {"type": "string"},
            "strengths": {"type": "array", "items": {"type": "string"}, "maxItems": 4},
            "watchouts": {"type": "array", "items": {"type": "string"}, "maxItems": 4},
            "writerQuestions": {"type": "array", "items": {"type": "string"}, "maxItems": 4}
        },
        "required": [
            "sceneFunction", "dramaticGoal", "characterDrive", "conflict", "stakes",
            "turningPoint", "change", "newInformation", "pacing", "dialogueReading",
            "visualReading", "continuity", "strengths", "watchouts", "writerQuestions"
        ]
    });

    let raw = generate(&model, &prompt, Some(schema)).await?;
    let value: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("استجابة القراءة الدرامية ليست JSON صالحاً: {e}"))?;

    let text = |key: &str| {
        value
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or("غير واضح من المشهد")
            .trim()
            .to_string()
    };

    Ok(SceneDramaticAnalysis {
        scene_function: text("sceneFunction"),
        dramatic_goal: text("dramaticGoal"),
        character_drive: text("characterDrive"),
        conflict: text("conflict"),
        stakes: text("stakes"),
        turning_point: text("turningPoint"),
        change: text("change"),
        new_information: text("newInformation"),
        pacing: text("pacing"),
        dialogue_reading: text("dialogueReading"),
        visual_reading: text("visualReading"),
        continuity: text("continuity"),
        strengths: vec_strings(&value, "strengths"),
        watchouts: vec_strings(&value, "watchouts"),
        writer_questions: vec_strings(&value, "writerQuestions"),
        source: "ollama".into(),
    })
}

#[tauri::command]
pub async fn ai_analyze_script(model: String, full_script_text: String) -> Result<AiAnalysis, String> {
    let prompt = format!(r#"
أنت قارئ سيناريو محترف. حلل النص التالي باقتصاد ودقة، من دون اختراع أحداث غير موجودة.
أعد JSON فقط وفق المخطط المطلوب. الاقتراحات مهنية وقصيرة وبالعربية.
احسب wordCount تقريبيا من النص، estimatedDurationMin بالدقائق، dialogueRatio بين 0 و1.

النص:
---
{}
---
"#, full_script_text);

    let schema = json!({
        "type": "object",
        "properties": {
            "wordCount": {"type": "integer"},
            "estimatedDurationMin": {"type": "number"},
            "dialogueRatio": {"type": "number"},
            "pacingIssues": {"type": "array", "items": {"type": "string"}},
            "suggestions": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["wordCount", "estimatedDurationMin", "dialogueRatio", "pacingIssues", "suggestions"]
    });

    let raw = generate(&model, &prompt, Some(schema)).await?;
    let value: Value = serde_json::from_str(&raw).map_err(|e| format!("استجابة التحليل ليست JSON صالحاً: {e}"))?;

    Ok(AiAnalysis {
        word_count: value.get("wordCount").and_then(Value::as_u64).unwrap_or(0) as usize,
        estimated_duration_min: value.get("estimatedDurationMin").and_then(Value::as_f64).unwrap_or(0.0),
        dialogue_ratio: value.get("dialogueRatio").and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 1.0),
        pacing_issues: vec_strings(&value, "pacingIssues"),
        suggestions: vec_strings(&value, "suggestions"),
        source: "ollama".into(),
    })
}

#[tauri::command]
pub async fn ai_extract_entities(model: String, full_script_text: String) -> Result<ExtractedEntities, String> {
    let prompt = format!(r#"
استخرج الشخصيات والمواقع من السيناريو التالي فقط. لا تضف أسماء غير موجودة.
role يجب أن تكون main أو secondary أو extra.
typeIntExt يجب أن تكون INT أو EXT أو INT/EXT حين يمكن استنتاجها.
أعد JSON فقط.

النص:
---
{}
---
"#, full_script_text);

    let schema = json!({
        "type": "object",
        "properties": {
            "characters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "role": {"type": "string", "enum": ["main", "secondary", "extra"]},
                        "occurrences": {"type": "integer"}
                    },
                    "required": ["name", "description", "role", "occurrences"]
                }
            },
            "locations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "typeIntExt": {"type": "string"},
                        "occurrences": {"type": "integer"}
                    },
                    "required": ["name", "typeIntExt", "occurrences"]
                }
            }
        },
        "required": ["characters", "locations"]
    });

    let raw = generate(&model, &prompt, Some(schema)).await?;
    let value: Value = serde_json::from_str(&raw).map_err(|e| format!("استجابة الاستخراج ليست JSON صالحاً: {e}"))?;

    let characters = value.get("characters").and_then(Value::as_array).map(|items| {
        items.iter().filter_map(|item| {
            let name = item.get("name")?.as_str()?.trim().to_string();
            if name.is_empty() { return None; }
            let role = item.get("role").and_then(Value::as_str).unwrap_or("secondary");
            let role = match role { "main" | "secondary" | "extra" => role, _ => "secondary" };
            Some(ExtractedCharacter {
                name,
                description: item.get("description").and_then(Value::as_str).unwrap_or("").to_string(),
                role: role.to_string(),
                occurrences: item.get("occurrences").and_then(Value::as_u64).unwrap_or(1) as usize,
            })
        }).collect()
    }).unwrap_or_default();

    let locations = value.get("locations").and_then(Value::as_array).map(|items| {
        items.iter().filter_map(|item| {
            let name = item.get("name")?.as_str()?.trim().to_string();
            if name.is_empty() { return None; }
            Some(ExtractedLocation {
                name,
                type_int_ext: item.get("typeIntExt").and_then(Value::as_str).unwrap_or("INT").to_string(),
                occurrences: item.get("occurrences").and_then(Value::as_u64).unwrap_or(1) as usize,
            })
        }).collect()
    }).unwrap_or_default();

    Ok(ExtractedEntities { characters, locations })
}

#[tauri::command]
pub async fn ai_improve_dialogue(
    model: String,
    character_bio: String,
    original_dialogue: String,
    emotion: String,
) -> Result<String, String> {
    let tone = match emotion.as_str() {
        "angry" => "غاضب ومتوتر",
        "sad" => "حزين ومقتصد",
        "fear" => "خائف ومضطرب",
        "funny" => "ساخر بخفة من دون افتعال",
        _ => "دارجة مغربية طبيعية وغير متكلفة",
    };
    let prompt = format!(r#"
أعد صياغة الحوار فقط، من دون شرح أو علامات اقتباس.
احترم شخصية المتكلم وسياقها. النبرة: {}.
لا توسع المعنى ولا تضف معلومات جديدة.
الشخصية: {}
الحوار الأصلي: {}
"#, tone, character_bio, original_dialogue);
    generate(&model, &prompt, None).await
}

#[tauri::command]
pub async fn ai_generate_action(model: String, idea: String) -> Result<String, String> {
    let prompt = format!(r#"
حوّل الفكرة التالية إلى وصف فعل سينمائي قصير وواضح بالعربية.
اكتب ما يمكن رؤيته أو سماعه فقط. لا تشرح المشاعر الداخلية ولا تضف حواراً.
أعد فقرة واحدة أو فقرتين فقط، من دون عنوان مشهد ومن دون شرح.
الفكرة: {}
"#, idea);
    generate(&model, &prompt, None).await
}

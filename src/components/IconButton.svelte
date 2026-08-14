<script lang="ts">
  import AppIcon from './AppIcon.svelte';
  export let icon: any = 'file';
  export let label = '';
  export let active = false;
  export let primary = false;
  export let danger = false;
  export let compact = false;
  export let disabled = false;
  export let placement: 'bottom' | 'left' = 'bottom';
  export let onClick: () => void = () => {};
</script>

<div class="icon-wrap" class:compact class:leftTip={placement === 'left'}>
  <button
    type="button"
    class="icon-action"
    class:active
    class:primary
    class:danger
    {disabled}
    aria-label={label}
    on:click={onClick}
  >
    <AppIcon name={icon} size={compact ? 17 : 19} />
  </button>
  {#if label}<span class="tooltip" role="tooltip">{label}</span>{/if}
</div>

<style>
  .icon-wrap { position:relative; display:inline-grid; place-items:center; }
  .icon-action { width:40px; height:40px; display:grid; place-items:center; border-radius:10px; border:1px solid var(--line); background:var(--panel-2); color:var(--text-2); transition:.15s ease; }
  .compact .icon-action { width:34px; height:34px; border-radius:9px; }
  .icon-action:hover:not(:disabled), .icon-action.active { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-line); transform:translateY(-1px); }
  .icon-action.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
  .icon-action.primary:hover:not(:disabled) { background:var(--accent-hover); color:#fff; border-color:var(--accent-hover); }
  .icon-action.danger:hover:not(:disabled) { color:var(--danger); background:var(--danger-soft); border-color:var(--danger-line); }
  .tooltip { pointer-events:none; opacity:0; transform:translate(-50%, 3px); position:absolute; left:50%; top:calc(100% + 8px); z-index:200; background:var(--tooltip-bg); color:var(--tooltip-text); border:1px solid var(--tooltip-line); border-radius:7px; box-shadow:var(--shadow-md); padding:6px 8px; font-size:11px; white-space:nowrap; transition:.12s ease; direction:rtl; }
  .icon-wrap:hover .tooltip, .icon-action:focus-visible + .tooltip { opacity:1; transform:translate(-50%, 0); }
  .leftTip .tooltip { left:auto; right:calc(100% + 8px); top:50%; transform:translate(3px,-50%); }
  .leftTip:hover .tooltip, .leftTip .icon-action:focus-visible + .tooltip { transform:translate(0,-50%); }
</style>

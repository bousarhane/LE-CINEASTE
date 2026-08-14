import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';

const savedTheme = localStorage.getItem('scene-writer-theme');
document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';

const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;

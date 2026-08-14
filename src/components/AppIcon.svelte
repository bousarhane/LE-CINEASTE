<script lang="ts">
  export let name: 'folder' | 'file' | 'story' | 'scenes' | 'users' | 'location' | 'sparkles' | 'import' | 'export' | 'projects' | 'sun' | 'moon' | 'fountain' | 'close' | 'chevron' | 'plus' | 'edit' | 'trash' | 'info' | 'board' | 'list' | 'filter' = 'file';
  export let size = 18;
  export let strokeWidth = 1.8;
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'folder'}
    <path d="M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" />
  {:else if name === 'file'}
    <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5v4h4" />
  {:else if name === 'story'}
    <path d="M5 4.5h12a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2Z" /><path d="M5 17.5a2 2 0 0 1 2-2h12" /><path d="M9 8h6M9 11h5" />
  {:else if name === 'scenes'}
    <rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M8 4v16M3.5 9h17M3.5 15h17" />
  {:else if name === 'users'}
    <circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-4 2.6-6 5.5-6s4.9 2 5.5 6" /><path d="M15.5 6.5a2.5 2.5 0 0 1 0 4.8M16 13c2.4.3 3.8 2.1 4.3 5" />
  {:else if name === 'location'}
    <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" />
  {:else if name === 'sparkles'}
    <path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z" /><path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z" /><path d="m6 13 .7 1.8 1.8.7-1.8.7L6 18l-.7-1.8-1.8-.7 1.8-.7L6 13Z" />
  {:else if name === 'import'}
    <path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M5 17v3h14v-3" />
  {:else if name === 'export'}
    <path d="M12 21V10" /><path d="m8 14 4-4 4 4" /><path d="M5 7V4h14v3" />
  {:else if name === 'projects'}
    <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 4v16M8 9h12" />
  {:else if name === 'sun'}
    <circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  {:else if name === 'moon'}
    <path d="M20 15.5A8 8 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z" />
  {:else if name === 'fountain'}
    <path d="M4 19h16" /><path d="M7 16c2-4 2.5-7.5 5-11 2.5 3.5 3 7 5 11" /><path d="M9.5 12h5" />
  {:else if name === 'close'}
    <path d="m6 6 12 12M18 6 6 18" />
  {:else if name === 'chevron'}
    <path d="m9 6 6 6-6 6" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'edit'}
    <path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" />
  {:else if name === 'trash'}
    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
  {:else if name === 'info'}
    <circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" />
  {:else if name === 'board'}
    <rect x="4" y="4" width="6.5" height="7" rx="1" /><rect x="13.5" y="4" width="6.5" height="4.5" rx="1" /><rect x="4" y="14" width="6.5" height="6" rx="1" /><rect x="13.5" y="11.5" width="6.5" height="8.5" rx="1" />
  {:else if name === 'list'}
    <path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="18" r="1" />
  {:else if name === 'filter'}
    <path d="M4 6h16M7 12h10M10 18h4" />
  {/if}
</svg>

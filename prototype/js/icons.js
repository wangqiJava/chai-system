/* 柴记账 · 管理后台 — 线性图标库（24x24 sprite，统一 1.7 描边） */
(function () {
  const S = {};
  const sym = (id, inner) => S[id] = '<symbol id="' + id + '" viewBox="0 0 24 24">' + inner + '</symbol>';

  /* 导航 */
  sym('i-overview', '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>');
  sym('i-user', '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c0-3.8 3.3-6 7.5-6s7.5 2.2 7.5 6"/>');
  sym('i-book', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>');
  sym('i-tag', '<path d="M12.6 2.5H20a1.5 1.5 0 0 1 1.5 1.5v7.4a1.5 1.5 0 0 1-.44 1.06l-8.6 8.6a1.5 1.5 0 0 1-2.12 0l-6.9-6.9a1.5 1.5 0 0 1 0-2.12l8.6-8.6a1.5 1.5 0 0 1 1.06-.44z"/><circle cx="16.3" cy="7.7" r="1.15"/>');
  sym('i-log', '<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/><path d="M8.5 13.5h7M8.5 17h5"/>');
  sym('i-server', '<rect x="3" y="3.5" width="18" height="7" rx="2"/><rect x="3" y="13.5" width="18" height="7" rx="2"/><path d="M7 7h.01M7 17h.01"/><path d="M11 7h6M11 17h6"/>');
  sym('i-msg', '<path d="M21 14.5a2 2 0 0 1-2 2H7.5l-4 4v-15a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2z"/><path d="M8 9.5h8M8 12.5h5"/>');
  sym('i-spec', '<circle cx="12" cy="12" r="9"/><path d="M16.2 7.8l-2.3 5.1-4.1 3.3 2.3-5.1z"/>');

  /* 通用操作 */
  sym('i-collapse', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9.5 4v16"/>');
  sym('i-chev-d', '<path d="M6 9.5l6 6 6-6"/>');
  sym('i-chev-r', '<path d="M9.5 6l6 6-6 6"/>');
  sym('i-chev-l', '<path d="M14.5 6l-6 6 6 6"/>');
  sym('i-search', '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16.2 16.2"/>');
  sym('i-close', '<path d="M6 6l12 12M18 6L6 18"/>');
  sym('i-plus', '<path d="M12 5v14M5 12h14"/>');
  sym('i-edit', '<path d="M12.5 20.5H21"/><path d="M16.4 3.6a2.05 2.05 0 0 1 2.9 2.9L7.5 18.3l-3.9 1 1-3.9z"/>');
  sym('i-eye', '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>');
  sym('i-eyeoff', '<path d="M3 3l18 18"/><path d="M10.7 5.7A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.1 3.9M6.4 6.6A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.6-.8"/><path d="M9.9 9.9a2.8 2.8 0 1 0 4.2 4.2"/>');
  sym('i-lock', '<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.2a4 4 0 0 1 8 0v3.3"/><path d="M12 14.5v2.5"/>');
  sym('i-check', '<path d="M4.5 12.5l5 5L19.5 6.5"/>');
  sym('i-info', '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11.5V16.5"/>');
  sym('i-warn', '<path d="M12 3.2L2.6 19.5h18.8z"/><path d="M12 9.5v4.2M12 17h.01"/>');
  sym('i-danger', '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.3M12 16.3h.01"/>');
  sym('i-clock', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>');
  sym('i-calendar', '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 2.8V7M16 2.8V7"/>');
  sym('i-refresh', '<path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.5"/><path d="M20 3.5v5h-5"/>');
  sym('i-up', '<path d="M12 19V5M6 11l6-6 6 6"/>');
  sym('i-down', '<path d="M12 5v14M18 13l-6 6-6-6"/>');
  sym('i-copy', '<rect x="9" y="9" width="11.5" height="11.5" rx="2"/><path d="M5.5 15h-1A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5v1"/>');
  sym('i-logout', '<path d="M9.5 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3h4"/><path d="M15.5 16.5l5-4.5-5-4.5M20.5 12H9.5"/>');
  sym('i-shield', '<path d="M12 2.5L4.5 5.5v6c0 4.7 3.2 8.1 7.5 9.9 4.3-1.8 7.5-5.2 7.5-9.9v-6z"/><path d="M9 11.8l2.1 2.1 4-4"/>');
  sym('i-link', '<path d="M13.5 5H19v5.5"/><path d="M19 5l-8.2 8.2"/><path d="M19 13.5v5A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-11A1.5 1.5 0 0 1 6.5 6H12"/>');
  sym('i-filter', '<path d="M4 5.5h16l-6.3 7.2v5.6l-3.4 1.8v-7.4z"/>');
  sym('i-more', '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>');
  sym('i-account', '<rect x="3" y="5" width="18" height="14.5" rx="2.5"/><path d="M5.5 8.5l5 3.8a2.5 2.5 0 0 0 3 0l5-3.8"/>');
  sym('i-key', '<circle cx="7.5" cy="16.5" r="4.2"/><path d="M10.6 13.4L21 3"/><path d="M15.5 8.5l3 3"/>');
  sym('i-database', '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5V18.5c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.5"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>');
  sym('i-monitor', '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M9 20.5h6M12 16.5v4"/>');
  sym('i-inbox', '<path d="M3.5 13.2L7 5h10l3.5 8.2v5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 13.2H9a3 3 0 0 0 6 0h5.5"/>');
  sym('i-chart', '<path d="M3.5 20.5h17"/><path d="M4.5 15.5l4.5-5 3.5 3 6.5-7.5"/>');

  /* 分类图标 */
  sym('i-bowl', '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M10 3.5c0 1 .9 1 .9 2s-.9 1-.9 2M14 3.5c0 1 .9 1 .9 2s-.9 1-.9 2"/>');
  sym('i-car', '<path d="M5.5 16.5H4.3a.8.8 0 0 1-.8-.8V12a2 2 0 0 1 2-2l1.6-3.3A2 2 0 0 1 8.9 5.5h6.2a2 2 0 0 1 1.8 1.1L18.5 10a2 2 0 0 1 2 2v3.7a.8.8 0 0 1-.8.8h-1.2"/><circle cx="7.5" cy="16.5" r="1.9"/><circle cx="16.5" cy="16.5" r="1.9"/><path d="M9.4 16.5h5.2M4.5 12h15"/>');
  sym('i-bag', '<path d="M5.5 8.5h13l1 11.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M9 11V6.5a3 3 0 0 1 6 0V11"/>');
  sym('i-home', '<path d="M4 10.8l8-7.1 8 7.1"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>');
  sym('i-play', '<circle cx="12" cy="12" r="9"/><path d="M10 8.6l5.6 3.4-5.6 3.4z"/>');
  sym('i-med', '<path d="M12 20.3C7.2 16.5 3.8 13.2 3.8 9.6A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.2 3c0 3.6-3.4 6.9-8.2 10.7z"/>');
  sym('i-edu', '<path d="M2.5 9.3L12 4.8l9.5 4.5L12 13.8z"/><path d="M6.5 11.7v4.1c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8v-4.1"/><path d="M21.5 9.3v5.2"/>');
  sym('i-gift', '<rect x="3.5" y="11" width="17" height="9.5" rx="1.5"/><path d="M3.5 7.5h17V11h-17z"/><path d="M12 7.5v13"/><path d="M12 7.5c-1.4 0-3.8-.6-3.8-2.5C8.2 3.4 9.6 3 10.5 3.4 11.7 4 12 6 12 7.5zm0 0c1.4 0 3.8-.6 3.8-2.5 0-1.6-1.4-2.1-2.3-1.6C12.3 4 12 6 12 7.5z"/>');
  sym('i-paw', '<ellipse cx="12" cy="15.8" rx="3.5" ry="2.7"/><circle cx="6.4" cy="11.2" r="1.7"/><circle cx="17.6" cy="11.2" r="1.7"/><circle cx="9.4" cy="7.9" r="1.7"/><circle cx="14.6" cy="7.9" r="1.7"/>');
  sym('i-dots', '<circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>');
  sym('i-cash', '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 10v4M18 10v4"/>');
  sym('i-medal', '<circle cx="12" cy="15" r="5.2"/><path d="M8 10.3L5.2 3.5h4.3L12 9l2.5-5.5h4.3L16 10.3"/><path d="M12 13v2.4l1.8 1"/>');
  sym('i-pie', '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>');
  sym('i-case', '<rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 12.8h18"/>');
  sym('i-envelope', '<rect x="3.5" y="5" width="17" height="14.5" rx="2"/><path d="M4 6.5l8 6 8-6"/>');

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' + Object.values(S).join('') + '</svg>';
  document.addEventListener('DOMContentLoaded', function () {
    document.body.insertAdjacentHTML('afterbegin', svg);
  });
})();

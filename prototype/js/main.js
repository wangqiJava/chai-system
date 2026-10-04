/* 柴记账 · 管理后台 — 共享交互脚本 */
/* global document, window, localStorage, URLSearchParams */

window.$ = function (sel, root) { return (root || document).querySelector(sel); };
window.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
window.escapeHTML = function (value) {
  var node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
};

/* ---------- 侧边栏折叠 ---------- */
(function () {
  var btn = $('#btnCollapse'), side = $('#sidebar');
  if (!side) return;
  $$('.nav-item', side).forEach(function (link) {
    var label = $('span', link);
    if (!label) return;
    link.title = label.textContent.trim();
    link.setAttribute('aria-label', link.title);
    if (link.classList.contains('active')) link.setAttribute('aria-current', 'page');
  });
  try { if (localStorage.getItem('chai-collapse') === '1') side.classList.add('collapsed'); } catch (e) {}
  function updateToggle() {
    if (!btn) return;
    var expanded = window.matchMedia('(max-width: 1280px)').matches ? side.classList.contains('expanded') : !side.classList.contains('collapsed');
    btn.setAttribute('aria-expanded', String(expanded));
    btn.setAttribute('aria-controls', side.id);
    btn.setAttribute('aria-label', expanded ? '折叠菜单' : '展开菜单');
  }
  updateToggle();
  window.addEventListener('resize', updateToggle);
  if (btn) btn.addEventListener('click', function () {
    if (window.matchMedia('(max-width: 1280px)').matches) {
      side.classList.toggle('expanded');
      side.classList.toggle('collapsed', !side.classList.contains('expanded'));
    } else side.classList.toggle('collapsed');
    try { localStorage.setItem('chai-collapse', side.classList.contains('collapsed') ? '1' : '0'); } catch (e) {}
    window.dispatchEvent(new Event('resize'));
  });
})();

/* ---------- 管理员下拉 ---------- */
(function () {
  var chip = $('#adminChip');
  if (!chip) return;
  var dd = $('.dropdown', chip);
  chip.tabIndex = 0;
  chip.setAttribute('aria-label', '管理员菜单');
  chip.setAttribute('aria-expanded', 'false');
  var logout = $('a[href^="login.html"]', dd);
  if (logout) logout.href = 'login.html';
  chip.addEventListener('click', function (e) {
    e.stopPropagation();
    dd.classList.toggle('open');
    chip.setAttribute('aria-expanded', String(dd.classList.contains('open')));
  });
  chip.addEventListener('keydown', function (e) {
    if (e.target === chip && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); chip.click(); }
    if (e.key === 'Escape') { dd.classList.remove('open'); chip.setAttribute('aria-expanded', 'false'); chip.focus(); }
  });
  document.addEventListener('click', function () { dd.classList.remove('open'); chip.setAttribute('aria-expanded', 'false'); });
})();

/* ---------- 页签 ---------- */
window.initTabs = function (root) {
  $$('[data-tabs]', root || document).forEach(function (wrap) {
    if (wrap.dataset.initialized) return;
    wrap.dataset.initialized = 'true';
    wrap.setAttribute('role', 'tablist');
    var tabs = $$('.tab-item', wrap);
    tabs.forEach(function (tab, index) {
      var key = tab.getAttribute('data-tab');
      tab.id = tab.id || 'tab-' + key;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'panel-' + key);
      tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
      tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
      var panel = $('[data-panel="' + key + '"]', wrap.parentNode);
      if (panel) {
        panel.id = panel.id || 'panel-' + key;
        tab.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
      }
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.classList.remove('active');
          t.tabIndex = -1;
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.tabIndex = 0;
        tab.setAttribute('aria-selected', 'true');
        var key = tab.getAttribute('data-tab');
        $$('[data-panel]', wrap.parentNode).forEach(function (p) {
          p.hidden = p.getAttribute('data-panel') !== key;
        });
        window.dispatchEvent(new Event('resize'));
        wrap.dispatchEvent(new CustomEvent('chai:tabchange', { bubbles: true, detail: { tab: key } }));
      });
      tab.addEventListener('keydown', function (e) {
        var next = index;
        if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        tabs[next].click();
        tabs[next].focus();
      });
    });
  });
};
// 页面内联脚本会立即应用 URL 预设，须先完成页签事件绑定。
initTabs();

/* ---------- 抽屉 / 弹窗 ---------- */
var layerStack = [];
var backgroundState = null;
function layerFocusables(dialog) {
  return $$('button, [href], input, select, textarea, [tabindex]', dialog).filter(function (el) {
    return !el.disabled && el.tabIndex >= 0 && el.getClientRects().length && !el.closest('[hidden], [inert]');
  });
}
function focusLayer(layer) {
  var field = $('input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])', layer.dialog);
  (field || layerFocusables(layer.dialog)[0] || layer.dialog).focus();
}
window.openLayer = function (id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (el.classList.contains('mask') || layerStack.some(function (item) { return item.el === el; })) return;
  var dialog = el.classList.contains('drawer') ? el : $('.modal', el);
  if (!dialog) return;
  var mask = el.previousElementSibling;
  if (!mask || !mask.classList.contains('mask')) mask = null;
  var layer = { el: el, dialog: dialog, mask: mask, trigger: document.activeElement };
  layerStack.push(layer);
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.tabIndex = -1;
  var title = $('.modal-title, .drawer-title', dialog);
  if (title && !dialog.hasAttribute('aria-label')) {
    title.id = title.id || id + '-title';
    dialog.setAttribute('aria-labelledby', title.id);
  }
  var background = $('.layout');
  if (background && !background.contains(el) && !backgroundState) {
    backgroundState = { el: background, inert: background.inert };
    background.inert = true;
  }
  focusLayer(layer);
};
window.closeLayer = function (id) {
  var el = document.getElementById(id);
  if (!el) return;
  var layer = layerStack.filter(function (item) { return item.el === el || item.mask === el; })[0];
  el.classList.remove('open');
  if (layer) {
    layer.el.classList.remove('open');
    if (layer.mask) layer.mask.classList.remove('open');
    layerStack = layerStack.filter(function (item) { return item !== layer; });
  }
  if (!layerStack.length) {
    document.body.style.overflow = '';
    if (backgroundState) {
      backgroundState.el.inert = backgroundState.inert;
      backgroundState = null;
    }
  }
  if (layer) setTimeout(function () {
    var current = layerStack[layerStack.length - 1];
    if (current) { focusLayer(current); return; }
    var trigger = layer.trigger;
    if (!trigger.isConnected && trigger.id) trigger = document.getElementById(trigger.id);
    if (trigger && trigger.isConnected && trigger.getClientRects().length) trigger.focus();
  }, 0);
};
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-open]');
  if (t) { openLayer(t.getAttribute('data-open')); return; }
  var c = e.target.closest('[data-close]');
  if (c) { closeLayer(c.getAttribute('data-close')); return; }
  if (e.target.classList.contains('mask') || e.target.classList.contains('modal-wrap')) {
    closeLayer(e.target.id);
  }
});
document.addEventListener('keydown', function (e) {
  var layer = layerStack[layerStack.length - 1];
  if (!layer) return;
  if (e.key === 'Escape') { e.preventDefault(); closeLayer(layer.el.id); return; }
  if (e.key !== 'Tab') return;
  var items = layerFocusables(layer.dialog);
  var first = items[0], last = items[items.length - 1];
  if (!first) { e.preventDefault(); layer.dialog.focus(); return; }
  if (e.shiftKey && (document.activeElement === first || document.activeElement === layer.dialog)) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
});
document.addEventListener('focusin', function (e) {
  var layer = layerStack[layerStack.length - 1];
  if (layer && !layer.dialog.contains(e.target)) focusLayer(layer);
});

/* ---------- Toast ---------- */
var TOAST_IC = { ok: 'i-check', warn: 'i-warn', err: 'i-danger', info: 'i-info' };
window.toast = function (msg, type) {
  type = type || 'ok';
  var wrap = $('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#' + TOAST_IC[type] + '"/></svg><span>' + escapeHTML(msg) + '</span>';
  wrap.appendChild(el);
  setTimeout(function () {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0'; el.style.transform = 'translateY(-8px)';
    setTimeout(function () { el.remove(); }, 260);
  }, 2800);
};

/* ---------- 复制 ---------- */
window.copyText = function (text) {
  var done = function () { toast('已复制：' + text, 'ok'); };
  var failed = function () { toast('复制失败，请手动选中内容后复制', 'warn'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, failed);
  } else { failed(); }
};

/* ---------- 头像 ---------- */
var AVATAR_COLORS = ['#007AFF', '#34C759', '#FF9F0A', '#AF52DE', '#FF6482', '#5AC8FA', '#FF7043', '#26A69A'];
window.avatarHTML = function (name, id, cls) {
  var code = 0; var key = id || name || '';
  for (var i = 0; i < key.length; i++) code += key.charCodeAt(i);
  var color = AVATAR_COLORS[code % AVATAR_COLORS.length];
  var ch = (name || '用').replace(/^「|」$/g, '').charAt(0);
  return '<span class="avatar ' + (cls || '') + '" style="background:' + color + '">' + ch + '</span>';
};

/* ---------- 表格状态：骨架屏 / 空态 ---------- */
window.skeletonRows = function (cols, rows) {
  rows = rows || 5;
  var html = '';
  for (var r = 0; r < rows; r++) {
    html += '<tr class="sk-row"><td><span class="sk sm"></span></td>';
    for (var c = 1; c < cols; c++) {
      var w = c % 3 === 0 ? 'sm' : (c % 2 === 0 ? 'md' : 'lg');
      html += '<td><span class="sk ' + w + '"></span></td>';
    }
    html += '</tr>';
  }
  return html;
};
window.stateBlockHTML = function (type, opts) {
  opts = opts || {};
  var map = {
    noresult: { icon: 'i-search', title: opts.title || '未找到符合条件的结果', desc: opts.desc || '请调整筛选条件后重新查询', btn: '清空筛选' },
    empty: { icon: 'i-inbox', title: opts.title || '暂无数据', desc: opts.desc || '尚未接入数据源，接入后在此展示', btn: null, tag: '待接入' },
    error: { icon: 'i-danger', title: '接口请求失败', desc: '请稍后重试；若持续失败请联系系统管理员', btn: '重试' },
    noauth: { icon: 'i-lock', title: '无访问权限', desc: '当前管理员账号未分配该模块权限，如需开通请联系超级管理员', btn: '返回数据概览' },
    loading: { icon: null, title: '加载中…', desc: '' }
  };
  var m = map[type] || map.empty;
  return '<div class="state-block">' +
    (m.icon ? '<div class="state-ic"><svg class="ic"><use href="#' + m.icon + '"/></svg></div>' : '') +
    (m.tag ? '<div style="margin:-6px 0 8px"><span class="tag tag-dashed">' + m.tag + '</span></div>' : '') +
    '<div class="state-title">' + m.title + '</div>' +
    (m.desc ? '<div class="state-desc">' + m.desc + '</div>' : '') +
    (m.btn ? '<button class="btn btn-sm" onclick="' + (opts.btnFn || 'void(0)') + '">' + m.btn + '</button>' : '') +
    '</div>';
};

/* ---------- 模拟查询：骨架屏 → 结果 ---------- */
window.simulateQuery = function (renderFn, delay) {
  renderFn('loading');
  setTimeout(function () { renderFn('done'); }, delay == null ? 550 : delay);
};

/* ---------- 数字格式化 ---------- */
window.fmtNum = function (n) { return Number(n).toLocaleString('zh-CN'); };
window.fmtAmt = function (n) {
  var neg = n < 0; var s = Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? '-' : '') + s;
};

/* ---------- URL 参数 ---------- */
window.queryOf = function () { return new URLSearchParams(window.location.search); };

/* ============================================================
   图表（纯 SVG，克制风格）
   ============================================================ */
var chartRegistry = [];
function niceMax(v) {
  if (v <= 5) return 5;
  var pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (var m = 1; m <= 5; m++) { if (m * pow / 2 >= v) { var c = m * pow / 2; if (m === 1) c = pow; return c; } }
  return pow * 10;
}
function axisFmt(v) {
  if (v >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}
function chartTipHTML(label, name, value, unit) {
  return '<div style="color:#86909C;font-size:11px">' + label + '</div><div>' + name + ' <b>' + fmtNum(value) + '</b> ' + (unit || '') + '</div>';
}

window.drawLineChart = function (el, labels, values, opts) {
  opts = opts || {};
  var color = opts.color || '#007AFF';
  var name = opts.name || '数值';
  var unit = opts.unit || '';
  function draw() {
    var w = el.clientWidth || 480, h = opts.height || 220;
    var padL = 38, padR = 10, padT = 12, padB = 24;
    var iw = w - padL - padR, ih = h - padT - padB;
    var max = niceMax(Math.max.apply(null, values));
    var step = iw / (values.length - 1);
    var pts = values.map(function (v, i) {
      return [padL + step * i, padT + ih - (v / max) * ih];
    });
    var grid = '', labelsHtml = '';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + ih - (ih * g / 4);
      var gv = max * g / 4;
      grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="#F2F3F5"/>';
      grid += '<text x="' + (padL - 6) + '" y="' + (gy + 3.5) + '" text-anchor="end" font-size="10.5" fill="#86909C">' + axisFmt(gv) + '</text>';
    }
    var every = Math.ceil(labels.length / 7);
    labels.forEach(function (lb, i) {
      if (i % every === 0 || i === labels.length - 1) {
        labelsHtml += '<text x="' + pts[i][0] + '" y="' + (h - 6) + '" text-anchor="middle" font-size="10.5" fill="#86909C">' + lb + '</text>';
      }
    });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    var area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (padT + ih) + ' L' + padL + ' ' + (padT + ih) + ' Z';
    el.innerHTML =
      '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="lg' + el.id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.12"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      grid +
      '<path d="' + area + '" fill="url(#lg' + el.id + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="#fff" stroke="' + color + '" stroke-width="1.6"/>'; }).join('') +
      '<line class="guide" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + ih) + '" stroke="#007AFF" stroke-dasharray="3 3" opacity="0"/>' +
      '<circle class="hotdot" r="4" fill="' + color + '" stroke="#fff" stroke-width="1.5" opacity="0"/>' +
      labelsHtml +
      '</svg><div class="chart-tip"></div>';

    var svgEl = el.querySelector('svg'), tip = el.querySelector('.chart-tip');
    var guide = el.querySelector('.guide'), hotdot = el.querySelector('.hotdot');
    svgEl.addEventListener('mousemove', function (e) {
      var rect = svgEl.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var idx = Math.min(values.length - 1, Math.max(0, Math.round((x - padL) / step)));
      var p = pts[idx];
      guide.setAttribute('x1', p[0]); guide.setAttribute('x2', p[0]); guide.setAttribute('opacity', '.5');
      hotdot.setAttribute('cx', p[0]); hotdot.setAttribute('cy', p[1]); hotdot.setAttribute('opacity', '1');
      tip.style.display = 'block';
      tip.innerHTML = chartTipHTML(labels[idx], name, values[idx], unit);
      var lx = Math.min(Math.max(p[0] - 60, 0), w - 130);
      tip.style.left = lx + 'px';
      tip.style.top = Math.max(p[1] - 52, 2) + 'px';
    });
    svgEl.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      guide.setAttribute('opacity', '0'); hotdot.setAttribute('opacity', '0');
    });
  }
  draw();
  chartRegistry.push(draw);
};

window.drawBarChart = function (el, labels, values, opts) {
  opts = opts || {};
  var color = opts.color || '#007AFF';
  var name = opts.name || '数值';
  var unit = opts.unit || '';
  function draw() {
    var w = el.clientWidth || 480, h = opts.height || 220;
    var padL = 38, padR = 10, padT = 12, padB = 24;
    var iw = w - padL - padR, ih = h - padT - padB;
    var max = niceMax(Math.max.apply(null, values));
    var step = iw / values.length;
    var bw = Math.min(26, step * 0.45);
    var grid = '', bars = '', labelsHtml = '';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + ih - (ih * g / 4);
      grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="#F2F3F5"/>';
      grid += '<text x="' + (padL - 6) + '" y="' + (gy + 3.5) + '" text-anchor="end" font-size="10.5" fill="#86909C">' + axisFmt(max * g / 4) + '</text>';
    }
    var rects = [];
    values.forEach(function (v, i) {
      var bh = Math.max(2, (v / max) * ih);
      var x = padL + step * i + (step - bw) / 2;
      var y = padT + ih - bh;
      rects.push([x, y, bw, bh, i]);
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" fill="' + color + '" opacity="0.82"><title>' + labels[i] + ' · ' + fmtNum(v) + unit + '</title></rect>';
    });
    var every = Math.ceil(labels.length / 8);
    labels.forEach(function (lb, i) {
      if (i % every === 0 || i === labels.length - 1) {
        labelsHtml += '<text x="' + (padL + step * i + step / 2) + '" y="' + (h - 6) + '" text-anchor="middle" font-size="10.5" fill="#86909C">' + lb + '</text>';
      }
    });
    el.innerHTML =
      '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + grid + bars + labelsHtml + '</svg><div class="chart-tip"></div>';
    var svgEl = el.querySelector('svg'), tip = el.querySelector('.chart-tip');
    svgEl.addEventListener('mousemove', function (e) {
      var rect = svgEl.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var idx = Math.min(values.length - 1, Math.max(0, Math.floor((x - padL) / step)));
      var r = rects[idx];
      tip.style.display = 'block';
      tip.innerHTML = chartTipHTML(labels[idx], name, values[idx], unit);
      tip.style.left = Math.min(Math.max(r[0] + r[2] / 2 - 60, 0), w - 130) + 'px';
      tip.style.top = Math.max(r[1] - 52, 2) + 'px';
      $$('rect', svgEl).forEach(function (b, bi) { b.setAttribute('opacity', bi === idx ? '1' : '0.5'); });
    });
    svgEl.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      $$('rect', svgEl).forEach(function (b) { b.setAttribute('opacity', '0.82'); });
    });
  }
  draw();
  chartRegistry.push(draw);
};

var resizeTimer = null;
window.addEventListener('resize', function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () { chartRegistry.forEach(function (f) { f(); }); }, 120);
});

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', function () {
  initTabs();
  $$('.field').forEach(function (field) {
    var label = $('label.field-label', field), input = $('input[id], select[id], textarea[id]', field);
    if (label && input && !label.htmlFor) label.htmlFor = input.id;
  });
  $$('svg.ic').forEach(function (icon) { icon.setAttribute('aria-hidden', 'true'); });
});

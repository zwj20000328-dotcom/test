(function () {
  try {
    var param = new URLSearchParams(location.search).get('theme');
    var saved = localStorage.getItem('zhizhan.theme.v1');
    var dark = param ? param === 'dark'
      : saved ? saved === 'dark'
      : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();

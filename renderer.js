// Zoom shortcuts
document.addEventListener('keydown', async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === '=') {
    e.preventDefault();
    await window.api.zoomIn();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    await window.api.zoomOut();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    await window.api.zoomReset();
  }
});

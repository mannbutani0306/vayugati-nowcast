export function observeLeafletContainer(map, element) {
  let frameId = 0;

  const invalidateSize = () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      if (element.isConnected) map.invalidateSize({ pan: false });
    });
  };

  const observer = new ResizeObserver(invalidateSize);
  observer.observe(element);
  window.addEventListener('resize', invalidateSize);
  invalidateSize();

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', invalidateSize);
    if (frameId) window.cancelAnimationFrame(frameId);
  };
}
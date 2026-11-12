const bundledFonts = import.meta.glob<string>('./fonts/Peyda.woff2', {
  eager: true,
  query: '?url',
  import: 'default',
});
let loading = false;
export function enablePeyda() {
  const url = bundledFonts['./fonts/Peyda.woff2'];
  if (!url || loading || typeof FontFace === 'undefined') return;
  loading = true;
  const font = new FontFace('Peyda Package', `url("${url}")`, { weight: '100 900' });
  void font
    .load()
    .then((loaded) => document.fonts.add(loaded))
    .catch(() => {});
}

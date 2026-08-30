# Package patches

## `metal-fx` 1.0.4

The installed 1.0.4 distribution can serialize negative SVG mask dimensions
when an attention-ring renderer collapses below twice its inset. The local
patch clamps those inner mask dimensions to zero in both the CommonJS and ESM
bundles so transient zero-size layout cannot create invalid SVG geometry.

The equivalent fix is not present in the installed upstream distribution.
Remove this patch only after upgrading to an upstream release that clamps both
bundles and after the collapsed-ring browser regression passes without the
patch.

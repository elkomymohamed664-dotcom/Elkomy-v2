# LIPOVERSE

An independent, no-build interactive learning experience about liposomes. It lives in its own folder so the existing PHYTO MOTION site remains unchanged.

## Included

- Responsive dark scientific interface, with English/Arabic language switching and RTL support.
- A real, locally bundled Three.js/WebGL liposome explorer with selectable components, layer visibility, cutaway mode, drag rotation and zoom. An interactive SVG model remains available as a WebGL fallback.
- Vesicle-type comparison, drug-loading simulator, high-level preparation lab, and delivery-journey simulation.
- Four real-world formulation examples, a five-question knowledge check, searchable glossary, and flashcards.
- No external network requests or build step. The bundled Three.js license is in `vendor/THREE-LICENSE.txt`.

All content is educational. The diagrams are not to scale and product details should be checked against current official labeling.

## Run locally

From the repository root:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Open <http://localhost:8000/lipoverse/>. The page can also be served directly from this directory with any static-file host.

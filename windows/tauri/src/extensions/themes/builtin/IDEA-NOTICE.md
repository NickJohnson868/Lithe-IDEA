# IDEA Islands palette reference

The Islands Dark UI, editor, and file-status palette in `lithe.json` is adapted
from JetBrains/intellij-community at commit
`d763f43a424abb418492519b0968a769eff0939d`:

- `platform/platform-resources/src/themes/islands/ManyIslandsDark.theme.json`
- `platform/platform-resources/src/themes/islands/IslandSchemeDark.xml`
- `platform/platform-resources/src/DefaultColorSchemesManager.xml` (inherited
  Darcula diff colors)

Source: https://github.com/JetBrains/intellij-community/tree/d763f43a424abb418492519b0968a769eff0939d

Copyright JetBrains s.r.o. and contributors. The referenced source is distributed
under the Apache License, Version 2.0. See the repository's Apache license at
https://www.apache.org/licenses/LICENSE-2.0

The pinned repository's `LICENSE.txt` identifies the open-source components as
Apache-2.0 and separately describes terms for JetBrains open-source builds:
https://github.com/JetBrains/intellij-community/blob/d763f43a424abb418492519b0968a769eff0939d/LICENSE.txt
This adaptation uses palette values from the two public resource files listed
above; it does not redistribute a JetBrains open-source build.

The UI keys are independently mapped to Lithe's CSS and Monaco theme vocabulary.
The commit is a reproducible source reference, not a claim that all UI states
have passed screenshot comparison against the user's installed IDEA build.
No JetBrains proprietary executable or plugin is bundled by this adaptation.

Ubuntu Mono is bundled through the pinned `@fontsource/ubuntu-mono` package,
under Ubuntu Font Licence 1.0. Its original license accompanies the npm package;
the font license is distinct from the palette source's Apache license.

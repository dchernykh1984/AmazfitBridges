# Changelog

## [0.3.0](https://github.com/dchernykh1984/AmazfitBridges/compare/amazfit-bridges-v0.2.1...amazfit-bridges-v0.3.0) (2026-08-08)


### Features

* add a script that builds and proves the shipped boards ([e68e316](https://github.com/dchernykh1984/AmazfitBridges/commit/e68e31617dbd287fb2347f873a66e57690b89979))
* deal boards from the built-in collection on the watch ([869fd38](https://github.com/dchernykh1984/AmazfitBridges/commit/869fd38df3cec0a0cb0c20f4db8543298c3f7d14))
* deal built-in boards without repeating one until the pool runs dry ([2747289](https://github.com/dchernykh1984/AmazfitBridges/commit/27472891d815ed6898d3f7049a3cf3f48b07a327))
* keep records apart for built-in and generated boards ([1e835ad](https://github.com/dchernykh1984/AmazfitBridges/commit/1e835ad0919775f2f249392cd36d0b5049e6b104))
* keep the best boards out of a large sample instead of the first that fit ([474943d](https://github.com/dchernykh1984/AmazfitBridges/commit/474943dce2e1ad0c55dc0603cdafd949852674c3))
* let the player choose built-in boards or one rolled on the watch ([1fae16f](https://github.com/dchernykh1984/AmazfitBridges/commit/1fae16fcc074bf98f194cefbca41e6a8c1cf1105))
* let the solver switch a rule off, and deduce with connectivity ([a4f939a](https://github.com/dchernykh1984/AmazfitBridges/commit/a4f939a5cacde6562bbe0cdfb91d84199c8b66a2))
* measure how many of the game's rules a board actually uses ([6e460fc](https://github.com/dchernykh1984/AmazfitBridges/commit/6e460fc58907c3f77ef9e0dbd038f961f1cf10e7))
* name the boards by size instead of by a difficulty they do not have ([248e631](https://github.com/dchernykh1984/AmazfitBridges/commit/248e631cd09398c41f403893da1a79a7c348c3c7))
* pack the board grids into a module the watch imports ([b3ee5a4](https://github.com/dchernykh1984/AmazfitBridges/commit/b3ee5a475630672f375b7e3a5f430f2806386646))
* regenerate the collection so every board uses more than one rule ([edabd02](https://github.com/dchernykh1984/AmazfitBridges/commit/edabd02e09bbea96c9725a20783bb21b04d72291))
* ship 2500 built-in boards ([1c50823](https://github.com/dchernykh1984/AmazfitBridges/commit/1c5082334507f3b0e7e75b2decbaad8574ad2bc2))
* write a board as a readable grid and a packed code ([282446c](https://github.com/dchernykh1984/AmazfitBridges/commit/282446c7359bd14637760658265a98d5a3b8476a))


### Bug Fixes

* check a collection against the board count its own header declares ([907163b](https://github.com/dchernykh1984/AmazfitBridges/commit/907163be0974e873a5bcf36d56186c8b5a166388))
* close loops before doubling bridges, so boards stop being all doubles ([ead7fe6](https://github.com/dchernykh1984/AmazfitBridges/commit/ead7fe673e1ef93705ae25e82d36840e2a21c4ee))
* fall back to the remembered value when storage reads back nothing ([a41669f](https://github.com/dchernykh1984/AmazfitBridges/commit/a41669f470efe61d78b1141c72c475f5d65f712a))
* forget the dealt board when the size or the source changes ([c43b99f](https://github.com/dchernykh1984/AmazfitBridges/commit/c43b99fc8748f7b7354c3d66afa32a51cc6304b5))
* keep every island inside the round screen ([0b27ce3](https://github.com/dchernykh1984/AmazfitBridges/commit/0b27ce337df122c5d76cea5d2b61f69ee3c565a2))
* keep the file header of a board collection in one block ([f0c8777](https://github.com/dchernykh1984/AmazfitBridges/commit/f0c8777be24cd6e89327ba8c2c85c92036a4ee93))
* name an island-free grid as empty rather than as a duplicate ([87e7de7](https://github.com/dchernykh1984/AmazfitBridges/commit/87e7de77d0b2450ed10158dfbf993baf0d43a9c5))
* refuse to pack an island-free grid into a code nothing can read ([2e872ce](https://github.com/dchernykh1984/AmazfitBridges/commit/2e872ce2c3db7c32049bd836884a11ec99d4d443))
* separate the size and source buttons like every other pair ([b29d472](https://github.com/dchernykh1984/AmazfitBridges/commit/b29d472abe03a1916ed15a725e16bfb6735f2b65))
* stop offering the drag hint on a board that fits the screen whole ([79bc8ff](https://github.com/dchernykh1984/AmazfitBridges/commit/79bc8ff31229a590a0199bfa2bf604813b0caffe))

## [0.2.1](https://github.com/dchernykh1984/AmazfitBridges/compare/amazfit-bridges-v0.2.0...amazfit-bridges-v0.2.1) (2026-08-06)


### Bug Fixes

* keep the app version in step with every release ([a3959a2](https://github.com/dchernykh1984/AmazfitBridges/commit/a3959a21d22bf9a05786b54c32bb5116610e5771))

## [0.2.0](https://github.com/dchernykh1984/AmazfitBridges/compare/amazfit-bridges-v0.1.0...amazfit-bridges-v0.2.0) (2026-08-04)


### Features

* add the Hashiwokakero rules and a seeded random source ([a1c9830](https://github.com/dchernykh1984/AmazfitBridges/commit/a1c9830b966113e306d51961b4ccec1b02498225))
* drag the board around like a map ([2e65e33](https://github.com/dchernykh1984/AmazfitBridges/commit/2e65e335c708fb48338c65375c90d02119017320))
* draw and play the game on the watch ([f6d7daf](https://github.com/dchernykh1984/AmazfitBridges/commit/f6d7dafc6ea609c68a21d30eb0ac20ea2824d9e8))
* generate boards across four difficulties ([03b8102](https://github.com/dchernykh1984/AmazfitBridges/commit/03b81029026d4d412a4b13e085e3d50115da4c65))
* lay the board and the controls out on a round screen ([2b2cf73](https://github.com/dchernykh1984/AmazfitBridges/commit/2b2cf73d1d06568bdef66122327b168dd767e6e3))
* play a board with taps, selection and undo ([1014e32](https://github.com/dchernykh1984/AmazfitBridges/commit/1014e32e37da40ca3676567e8463d6a18c6f184a))
* remember best times and boards solved per difficulty ([f719205](https://github.com/dchernykh1984/AmazfitBridges/commit/f71920537dbb7ca96200dcfcb23231720e5863e7))
* solve a board and prove it needs exactly one answer and no guesswork ([a2ceabc](https://github.com/dchernykh1984/AmazfitBridges/commit/a2ceabc32c0360bf80c21a60d0c883d14465ad8c))
* translate the watch screens into eleven languages ([deb0c28](https://github.com/dchernykh1984/AmazfitBridges/commit/deb0c288409295b1a92aa6cbf27c95e47687d8f6))


### Bug Fixes

* budget the action bar labels for the narrow buttons they sit on ([6479d0b](https://github.com/dchernykh1984/AmazfitBridges/commit/6479d0b7c05f037c0d14d9efa75bd40ca06e6c41))
* never hand Zepp OS a negative widget coordinate when the map is dragged ([2d406ea](https://github.com/dchernykh1984/AmazfitBridges/commit/2d406ea0365cb60ce5b178c8fed8cf75f7087dc0))
* stop menu text hanging over the edge of its own panel ([8389e52](https://github.com/dchernykh1984/AmazfitBridges/commit/8389e52557b819d963cae03c5a558e5ca4b7e0cc))

# Clothing, apps and TV expansion

Adds 147 entries and 96 alternates: **112 apps, 64 TV channels, 81 clothing brands, 1369 total entries and 741 alternates** (merged on top of the characters and brands expansion).

| Collection | Before | After | Categories (count) |
|---|---|---|---|
| APPS | 50 | 112 | Built-in 22, Social 21, Games 17, Music & Video 19, Everyday 21, **Productivity** 12 |
| TV | 30 | 64 | Broadcast 9, Cable 10, Music & Pop 5, Kids 10, Discovery & Lifestyle 11, **Sports** 8, **International** 11 |
| CLOTHING | 30 | 81 | Sportswear 17, Streetwear 11, Outdoor 15, Preppy 12, Everyday 9, **Surf & Skate** 10, **Footwear** 7 |

36 alternates went to 29 existing entries (the 2006 Twitter bird, four more Angry Birds, Chrome's 2008 orb, PBS's 1971 P-head, the Nickelodeon blimp, Reebok's starcrest, Puma's 1948 Dassler badge, BAPE's Baby Milo, Pac-Man's red ghost…), and 60 came with 48 of the new entries (Microsoft Word, Excel and PowerPoint's 2013 and classic icons, CBC's 1974 exploding pizza and 1966 butterfly, Channel 4's 1982 blocks, older Globo, Televisa and Record TV marks, Le Coq Sportif's red triangle, Quiksilver's 1970 wave…). The collections now hold 87 app, 52 channel and 38 clothing alternates.

## Behavior

- New categories are added at the end of each collection's filter row, so existing filters and saved preferences keep their positions. Hints read "Logo: Productivity app", "Logo: Sports channel", "Logo: International channel", "Logo: Surf & Skate brand" and "Logo: Footwear brand".
- Existing entries, IDs, artwork and palettes are unchanged; existing entries only gained `alternateLogos`, appended after their current ones (checked field by field against `main`), so saved rounds and Shuffle Logo order load as before.
- Name-visible artwork is flagged `showsName` and sits random logo pools out, like the existing wordmark entries: Candy Crush Saga; The CW, AMC, FX, Disney XD, TLC, NFL Network, NBA TV, MLB Network, FS1, BBC and Nine Network; H&M, Zara, Uniqlo, Old Navy, UGG and Dr. Martens. Every other new primary and every alternate is a name-free symbol, mascot, icon or monogram, and no alternate label contains the answer.
- Every brand palette's second color is a real brand color, never white, so the team browser never shows two white swatches.
- Already in the catalog, so not added again: Uber and Paramount (BRANDS), Pac-Man, Brawl Stars and Tetris (CHARACTERS). Pac-Man's red ghost became an alternate of the CHARACTERS entry, and six alternates that matched marks the brands expansion had already added (Reddit's full-body alien, the 2013 App Store A, the Roblox roundel, the Gmail envelope, Under Armour's 1996 mark, Snapchat's 2011 ghost) were dropped.
- Left out on purpose: Facebook (already an accepted answer for Meta), Apple TV (its icon spells "tv"), Paramount Network (the same star-ringed mountain as Paramount), Sky and Sky Sports ("Sky" is the Chicago Sky), USA Network ("USA" is the US flag), the SEC, ACC and Big Ten networks (their marks are the college conference entries), and MSNBC/CNBC (the NBC peacock).

## Artwork

- All new artwork is checked-in SVG. Each variant's source URL, source page, source SHA-256 and reviewed `brand_vector.py` edits are pinned in `scripts/brand_artwork_sources.json`; output checksums and palette roles are in `apps-manifest.json`, `tv-manifest.json`, `clothing-manifest.json` and `characters-manifest.json`. Sources: Iconify sets, Wikimedia Commons, Logopedia, Logowik, worldvectorlogo, iconape and similar.
- Wordmarks, taglines, ®/™ marks and page backgrounds are removed with element edits. Where a symbol shares one path with lettering or a neighboring mark (O'Neill, Merrell, Sperry, the Russell R, the Asics stripes, the Hummel chevrons, the Obey face, Brooks' older chevron, Off-White's stripes, the Polo jeans flag, the Wrangler horse tab, the Fortnite llama), `clipToViewBox` enforces the reviewed crop.
- Every variant was reviewed on white and dark contact sheets, then rendered with the game's `Logo` component in original colors and in two Buffalo Bills remixes: after the merge, all 243 originals and 486 remixes reached `ready`, with zero failures and zero page errors.

![Original and remixed artwork](artwork-review.png)

## Validation

- `npm run logos:apps|tv|clothing|characters` reuses every checked-in asset offline (a forbidden-fetch check passes), and every brand builder leaves `teams.json` byte-for-byte unchanged.
- Full suite after merging `main`: 189 passed, 1 skipped (the optional Potrace test), 0 failed. `npm run build` passes with Vite's standard >500 KB bundle advisory.
- Playwright Chromium, 1024×1366 with touch: CLOTHING → Footwear shows 7 tiles; Crocs picked and remixed in Los Angeles Lakers colors.
- Playwright Chromium, 390×844 with touch, dark mode: APPS → Productivity shows 12 tiles and TV → International shows 11 (Sports is next to it); no page-wide horizontal overflow, no page errors and no failed requests.

Screenshots:

- [CLOTHING picker, Footwear, on iPad](clothing-picker-ipad.png)
- [Crocs in Lakers colors on iPad](crocs-in-lakers-ipad.png)
- [APPS picker, Productivity, on phone, dark mode](apps-picker-phone-dark.png)
- [TV picker, International, on phone, dark mode](tv-picker-phone-dark.png)

The browser checks emulate viewport and touch behavior; they are not tests on physical iOS Safari.

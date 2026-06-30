# Guitar Practice — คู่มือการใช้งาน / User Guide

---

## สารบัญ / Table of Contents

- [การติดตั้งและเริ่มต้น / Setup & Getting Started](#การติดตั้งและเริ่มต้น--setup--getting-started)
- [Library — คลังเพลง](#library--คลังเพลง)
- [Song Editor — สร้าง/แก้ไขเพลง](#song-editor--สร้างแก้ไขเพลง)
- [Player — หน้าซ้อมกีต้าร์](#player--หน้าซ้อมกีต้าร์)
- [Metronome — เครื่องจับจังหวะ](#metronome--เครื่องจับจังหวะ)
- [YouTube Play-Along — เล่นตาม YouTube](#youtube-play-along--เล่นตาม-youtube)
- [Tap-Sync — บันทึก timing ของ chord](#tap-sync--บันทึก-timing-ของ-chord)
- [ChordPro Format — รูปแบบเนื้อเพลง](#chordpro-format--รูปแบบเนื้อเพลง)
- [Keyboard Shortcuts — คีย์ลัด](#keyboard-shortcuts--คีย์ลัด)

---

## การติดตั้งและเริ่มต้น / Setup & Getting Started

### ภาษาไทย

**ความต้องการของระบบ**
- Node.js 18 ขึ้นไป
- npm หรือ pnpm

**ขั้นตอนการติดตั้ง**

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. เริ่ม development server
npm run dev
```

เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

ข้อมูลเพลงจะถูกบันทึกในไฟล์ `.data/songs.json` ภายในโปรเจกต์ (สร้างอัตโนมัติเมื่อเพิ่มเพลงแรก)

---

### English

**Requirements**
- Node.js 18 or higher
- npm or pnpm

**Installation**

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

Open your browser to `http://localhost:3000`

Song data is stored in `.data/songs.json` inside the project (created automatically when you add your first song).

---

## Library — คลังเพลง

### ภาษาไทย

หน้าแรกเมื่อเปิดแอป แสดงรายการเพลงทั้งหมดของคุณ

**สิ่งที่ทำได้:**
- **ค้นหาเพลง** — พิมพ์ชื่อเพลงหรือชื่อศิลปินในช่อง Search ด้านบน
- **เปิดเพลง** — กดที่การ์ดเพลงเพื่อไปยังหน้าซ้อม (Player)
- **แก้ไขเพลง** — กดปุ่ม **Edit** มุมล่างขวาของการ์ด
- **ลบเพลง** — กดปุ่ม **Delete** แล้วยืนยัน
- **เพิ่มเพลงใหม่** — กดปุ่ม **+ New Song** มุมบนขวา

**Badge บนการ์ด:**
- `Am` / `G` — key ของเพลง
- `YT` (สีเขียว) — เพลงนี้มีข้อมูล YouTube sync แล้ว

---

### English

The home page when you open the app, showing all your songs.

**What you can do:**
- **Search** — type a song title or artist name in the Search bar at the top
- **Open a song** — click a card to go to the Practice Player
- **Edit a song** — click the **Edit** button at the bottom right of the card
- **Delete a song** — click **Delete** and confirm
- **Add a new song** — click **+ New Song** in the top right

**Card badges:**
- `Am` / `G` — the song's key
- `YT` (green) — YouTube sync timing has been recorded for this song

---

## Song Editor — สร้าง/แก้ไขเพลง

### ภาษาไทย

หน้าสำหรับสร้างหรือแก้ไขเพลง ประกอบด้วยฟอร์มทางซ้ายและ preview ทางขวา (บน desktop)  
บน mobile กด **Form** หรือ **Preview** เพื่อสลับมุมมอง

**ช่องกรอกข้อมูล:**

| ช่อง | คำอธิบาย |
|---|---|
| **Title** | ชื่อเพลง (จำเป็น) |
| **Artist** | ชื่อศิลปิน |
| **Original Key** | key ที่เพลงต้นฉบับเล่น (เช่น Am, G) |
| **Preferred Key** | key ที่คุณอยากเล่น (ถ้าต่างจากต้นฉบับ) |
| **Default Capo** | ตำแหน่ง capo เริ่มต้น (กด 0–12) |
| **YouTube URL** | ลิงก์ YouTube สำหรับเล่นตาม |
| **ChordPro** | เนื้อเพลงพร้อม chord ในรูปแบบ ChordPro |

**การ preview:**  
preview ทางขวาอัปเดตแบบ real-time ทุกครั้งที่พิมพ์ใน ChordPro textarea

**บันทึก:**  
กดปุ่ม **Save** มุมบนขวา → ระบบบันทึกและพาไปยังหน้า Player ของเพลงนั้นทันที

---

### English

The page for creating or editing a song. On desktop it shows the form on the left and a live preview on the right.  
On mobile, tap **Form** or **Preview** to switch between views.

**Fields:**

| Field | Description |
|---|---|
| **Title** | Song name (required) |
| **Artist** | Artist / band name |
| **Original Key** | The key the original song is in (e.g. Am, G) |
| **Preferred Key** | Your preferred playing key (if different from original) |
| **Default Capo** | Default capo position (tap 0–12) |
| **YouTube URL** | YouTube link for play-along |
| **ChordPro** | Song lyrics with inline chords in ChordPro format |

**Live preview:**  
The preview on the right updates in real-time as you type in the ChordPro textarea.

**Saving:**  
Click **Save** in the top right → the song is saved and you are taken to the Player immediately.

---

## Player — หน้าซ้อมกีต้าร์

### ภาษาไทย

หน้าหลักสำหรับซ้อม แบ่งเป็นส่วนต่าง ๆ จากบนลงล่าง:

**1. Control Bar (แถบบนสุด)**

| ปุ่ม | ฟังก์ชัน |
|---|---|
| **♭** | Transpose ลง 1 semitone |
| **Key display** (เช่น `Am`) | แสดง key ปัจจุบัน |
| **♯** | Transpose ขึ้น 1 semitone |
| **0–12 (chips)** | เลือกตำแหน่ง capo |
| **ไอคอนวิดีโอ** | เปิด/ซ่อน YouTube player |

> การเปลี่ยน capo จะรักษา sounding key ไว้ (chord บนหน้าจอเปลี่ยนตาม capo อัตโนมัติ)

**2. Chord Sheet (กลาง)**
- อ่าน chord และเนื้อเพลงในรูปแบบ ChordPro
- **กด chord ใดก็ได้** เพื่อดู chord diagram (ภาพแสดงการกด)
- chord ที่กำลังเล่นอยู่จะ highlight สีเหลืองเมื่อเปิด YouTube

**3. Bottom Toolbar (แถบล่าง)**

| ปุ่ม | ฟังก์ชัน |
|---|---|
| **▶ (เมโทรนอม)** | เปิด/ปิด metronome |
| **− / +** | ลด/เพิ่ม BPM (กดค้างเพื่อเปลี่ยนเร็ว) |
| **Scroll** | เปิด auto-scroll ตาม chord ที่กำลังเล่น |
| **Tap** | เข้าสู่โหมด Tap-Sync |

**Sidebar (Desktop)**  
ด้านซ้ายแสดงรายการเพลงทั้งหมด กดเพื่อสลับเพลง

---

### English

The main practice screen, divided top to bottom:

**1. Control Bar (top)**

| Button | Function |
|---|---|
| **♭** | Transpose down 1 semitone |
| **Key display** (e.g. `Am`) | Shows the current key |
| **♯** | Transpose up 1 semitone |
| **0–12 (chips)** | Select capo position |
| **Video icon** | Show/hide the YouTube player |

> Changing the capo preserves the sounding key — the displayed chords adjust automatically so your fingers play in the right position.

**2. Chord Sheet (middle)**
- Displays chords and lyrics in ChordPro format
- **Tap any chord** to see a chord diagram showing where to place your fingers
- The currently playing chord highlights in amber when YouTube is active

**3. Bottom Toolbar**

| Button | Function |
|---|---|
| **▶ (metronome)** | Start/stop the metronome |
| **− / +** | Decrease/increase BPM (hold for fast change) |
| **Scroll** | Toggle auto-scroll to follow the active chord |
| **Tap** | Enter Tap-Sync mode |

**Sidebar (Desktop)**  
Left panel lists all your songs — click to switch instantly.

---

## Metronome — เครื่องจับจังหวะ

### ภาษาไทย

- กดปุ่ม **▶** ใน Bottom Toolbar เพื่อเริ่ม metronome
- ใช้ **−** และ **+** ปรับ BPM (20–300) กดค้างเพื่อเปลี่ยนเร็ว
- beat แรกของแต่ละห้องจะมีเสียงดังกว่า (accent)
- Metronome ใช้ Web Audio API จึงแม่นยำและไม่ lag แม้บน iOS

> **iOS:** เสียงจะเริ่มหลังจากที่คุณแตะหน้าจอครั้งแรก (ข้อจำกัดของ browser)

---

### English

- Press **▶** in the Bottom Toolbar to start the metronome
- Use **−** and **+** to adjust BPM (20–300); hold for continuous change
- The first beat of each bar plays louder (accent)
- Uses the Web Audio API lookahead scheduler — stays precise even on iOS

> **iOS note:** Sound starts after your first tap on the screen (browser requirement).

---

## YouTube Play-Along — เล่นตาม YouTube

### ภาษาไทย

**การเพิ่มวิดีโอ:**
1. ใส่ YouTube URL ในช่อง **YouTube URL** ตอนสร้าง/แก้ไขเพลง  
   หรือกด **ไอคอนวิดีโอ** ใน Control Bar แล้วพิมพ์ URL ใหม่
2. กด **Load** — player จะโหลดวิดีโอ

**การ highlight chord อัตโนมัติ:**
- ต้องทำ Tap-Sync ก่อน (ดูหัวข้อถัดไป)
- เมื่อเล่นวิดีโอ chord บนหน้าจอจะ highlight ตาม timing ที่บันทึกไว้
- เปิด **Scroll** ให้หน้าจอเลื่อนตาม chord อัตโนมัติ

**หมายเหตุ:** วิดีโอบางคลิปปิดการ embed — หากขึ้นข้อความ error ให้ลองค้นหาคลิปอื่นของเพลงเดียวกัน

---

### English

**Adding a video:**
1. Enter the YouTube URL in the **YouTube URL** field when creating/editing the song  
   or tap the **video icon** in the Control Bar and type a URL there
2. Click **Load** — the player will load the video

**Automatic chord highlighting:**
- Requires Tap-Sync to be done first (see next section)
- While the video plays, chords on screen highlight to match the recorded timing
- Enable **Scroll** to auto-scroll the sheet following the active chord

**Note:** Some videos have embedding disabled — if you see an error, search for another upload of the same song.

---

## Tap-Sync — บันทึก timing ของ chord

### ภาษาไทย

Tap-Sync ใช้สำหรับบันทึกว่า chord แต่ละตัวเปลี่ยนที่เวลาไหนในวิดีโอ เพื่อให้ highlight chord ตรงกับเพลง

**ขั้นตอน:**
1. เปิด YouTube player และกดเล่นวิดีโอ
2. กดปุ่ม **Tap** ใน Bottom Toolbar เพื่อเข้าสู่โหมด Tap-Sync
3. กดปุ่ม **TAP** ขนาดใหญ่ **ทุกครั้งที่ chord เปลี่ยน**
   - กดให้ตรงกับจังหวะที่ได้ยินจริง
   - chord ถัดไปจะแสดงด้านล่างปุ่ม TAP
4. เมื่อ tap ครบทุก chord หน้าจอจะแสดงสัญลักษณ์ ✓
5. กด **Save** เพื่อบันทึก → กลับสู่ Player และ highlight จะทำงานทันที

**ปุ่มระหว่าง Tap-Sync:**

| ปุ่ม | ฟังก์ชัน |
|---|---|
| **TAP** | บันทึก timing ของ chord ปัจจุบัน |
| **Undo** | ยกเลิก tap ล่าสุด |
| **Reset** | เริ่มใหม่ตั้งแต่ต้น |
| **Save(N)** | บันทึกแบบ partial (N tap ที่ทำไปแล้ว) |
| **Exit** | ออกโดยไม่บันทึก |

**เคล็ดลับ:**
- กดปุ่ม TAP ในจังหวะที่คุณได้ยินเสียง chord เปลี่ยน ไม่ต้องรอให้ครบโน้ต
- ถ้า tap ช้า/เร็วไป ใช้ **Undo** แก้ไขได้เสมอ
- ทำซ้ำหลายรอบเพื่อให้ timing แม่นขึ้น

---

### English

Tap-Sync records the exact moment each chord changes in the video, so the chord highlighting stays in sync with the music.

**Steps:**
1. Open the YouTube player and press play
2. Tap **Tap** in the Bottom Toolbar to enter Tap-Sync mode
3. Press the large **TAP** button **every time the chord changes**
   - Tap in time with what you hear
   - The next chord is shown below the TAP button as a preview
4. Once all chords are tapped, a ✓ appears
5. Press **Save** — the timing is stored and highlighting activates immediately in the Player

**Buttons during Tap-Sync:**

| Button | Function |
|---|---|
| **TAP** | Record timing for the current chord |
| **Undo** | Remove the last tap |
| **Reset** | Start over from the beginning |
| **Save(N)** | Save a partial recording (N taps done so far) |
| **Exit** | Leave without saving |

**Tips:**
- Tap the moment you *hear* the chord change, not when you see it coming
- If you tap too early or late, Undo is always available
- Redo the sync a few times to dial in the timing

---

## ChordPro Format — รูปแบบเนื้อเพลง

### ภาษาไทย

ChordPro คือรูปแบบข้อความที่ใส่ chord ไว้ในวงเล็บเหลี่ยมก่อนพยางค์ที่ต้องเล่น chord นั้น

**ตัวอย่าง:**

```
{title: Let Her Go}
{artist: Passenger}
{key: C}
{capo: 2}

# Verse
[Am]Well you only need the [G]light when it's burn[F]ing low
[Am]Only miss the [G]sun when it starts to [C]snow
```

**Directives (ข้อมูลเพลง):**

| Directive | ความหมาย |
|---|---|
| `{title: ชื่อ}` | ชื่อเพลง |
| `{artist: ชื่อ}` | ชื่อศิลปิน |
| `{key: Am}` | key ของเพลง |
| `{capo: 2}` | ตำแหน่ง capo |

**รูปแบบ Chord:**
- `[Am]` — chord เพียว ๆ ก่อนพยางค์
- `[G/B]` — slash chord
- `[Cmaj7]` — chord ที่มีสัญลักษณ์ต่อท้าย

**Section headers:**
- `# Verse`, `# Chorus`, `# Bridge` — ขึ้นหัวข้อแต่ละส่วน

---

### English

ChordPro is a plain text format where chords are placed in square brackets immediately before the syllable where they are played.

**Example:**

```
{title: Let Her Go}
{artist: Passenger}
{key: C}
{capo: 2}

# Verse
[Am]Well you only need the [G]light when it's burn[F]ing low
[Am]Only miss the [G]sun when it starts to [C]snow
```

**Directives (song metadata):**

| Directive | Meaning |
|---|---|
| `{title: Name}` | Song title |
| `{artist: Name}` | Artist / band |
| `{key: Am}` | Song key |
| `{capo: 2}` | Capo position |

**Chord notation:**
- `[Am]` — plain chord before a syllable
- `[G/B]` — slash chord
- `[Cmaj7]` — chord with extension / quality suffix

**Section headers:**
- `# Verse`, `# Chorus`, `# Bridge` — label each section of the song

---

## Keyboard Shortcuts — คีย์ลัด

### โหมด Tap-Sync / Tap-Sync Mode

| คีย์ / Key | ฟังก์ชัน / Function |
|---|---|
| `Space` หรือ / or `Enter` | TAP — บันทึก chord / Record chord timing |
| `Z` หรือ / or `Backspace` | Undo — ยกเลิก tap ล่าสุด / Remove last tap |
| `Escape` | Exit — ออกโดยไม่บันทึก / Exit without saving |

---

## สคริปต์ที่ใช้ได้ / Available Scripts

```bash
npm run dev        # เริ่ม development server / Start dev server
npm run build      # Build สำหรับ production / Build for production
npm run start      # เริ่ม production server / Start production server
npm run test       # รันเทสทั้งหมด / Run all tests
npm run test:watch # รันเทสแบบ watch mode / Run tests in watch mode
```

---

*Guitar Practice — built with Next.js 16, React 19, Tailwind CSS v4, Web Audio API, YouTube IFrame API*

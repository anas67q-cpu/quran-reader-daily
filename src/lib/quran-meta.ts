// Static Madinah Mushaf (604-page) metadata.
// SURAH_STARTS[i] = first Mushaf page of surah (i+1). Length 114.
// JUZ_STARTS[i] = first Mushaf page of juz (i+1). Length 30.
// SURAH_NAMES_AR[i] = Arabic name of surah (i+1). Length 114.

export const TOTAL_PAGES = 604;

export const SURAH_STARTS: number[] = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267,
  282, 293, 305, 312, 322, 332, 342, 350, 359, 367, 377, 385, 396, 404, 411,
  415, 418, 428, 434, 440, 446, 453, 458, 467, 477, 483, 489, 496, 499, 502,
  507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542, 545, 549, 551,
  553, 554, 556, 558, 560, 562, 564, 566, 568, 570, 572, 574, 575, 577, 578,
  580, 582, 583, 585, 586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595,
  595, 596, 596, 597, 597, 598, 598, 599, 599, 600, 600, 601, 601, 601, 602,
  602, 602, 603, 603, 603, 604, 604, 604,
];

export const JUZ_STARTS: number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302,
  322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export const SURAH_NAMES_AR: string[] = [
  "الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال",
  "التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف",
  "مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص",
  "العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر",
  "غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات",
  "ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر",
  "الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم",
  "الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ",
  "النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى",
  "الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة",
  "الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر",
  "الكافرون","النصر","المسد","الإخلاص","الفلق","الناس",
];

function lastIndexLE(arr: number[], target: number): number {
  let lo = 0, hi = arr.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

export function surahForPage(page: number): { index: number; number: number; name: string } {
  const i = lastIndexLE(SURAH_STARTS, page);
  return { index: i, number: i + 1, name: SURAH_NAMES_AR[i] };
}

export function juzForPage(page: number): number {
  return lastIndexLE(JUZ_STARTS, page) + 1;
}

// Arabic-Indic numerals
export function toArabicDigits(n: number | string): string {
  const map = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
  return String(n).replace(/\d/g, (d) => map[+d]);
}

export function pageImageUrl(page: number): string {
  const p = String(page).padStart(3, "0");
  return `https://www.mp3quran.net/api/quran_pages_svg/${p}.svg`;
}

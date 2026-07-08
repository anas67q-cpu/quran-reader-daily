// Approximate Hijri date via Intl.DateTimeFormat (islamic-umalqura).
export function hijriToday(): string {
  try {
    const fmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return fmt.format(new Date()).replace("هـ", "").trim() + " هـ";
  } catch {
    return "";
  }
}

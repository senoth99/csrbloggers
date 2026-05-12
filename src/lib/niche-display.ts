/** Подпись ниши в интерфейсе выбора — в верхнем регистре (кириллица). */
export function nicheChoiceCaption(label: string): string {
  return label.trim().toLocaleUpperCase("ru-RU");
}

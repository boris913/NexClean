/** Concatène des classes en ignorant les valeurs vides (sans dépendance). */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

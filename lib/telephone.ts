// Normalisation des numéros de téléphone au format E.164 (specs/README : pays par défaut +237).

/** Renvoie le numéro au format E.164 (« +237690000000 »), ou null s'il est invalide. */
export function normaliserTelephone(saisie: string): string | null {
  const brut = saisie.trim();
  if (!brut) return null;
  let chiffres = brut.replace(/[\s.\-()/]/g, '');
  if (chiffres.startsWith('00')) chiffres = '+' + chiffres.slice(2);
  if (chiffres.startsWith('+')) {
    const reste = chiffres.slice(1);
    if (!/^\d{8,15}$/.test(reste)) return null;
    // Cameroun : 9 chiffres après l'indicatif, commençant par 2 (fixe) ou 6 (mobile).
    if (reste.startsWith('237') && !/^237[26]\d{8}$/.test(reste)) return null;
    return '+' + reste;
  }
  if (!/^\d+$/.test(chiffres)) return null;
  // Saisie sans indicatif : numéro camerounais (9 chiffres), éventuellement précédé de 237.
  if (/^237[26]\d{8}$/.test(chiffres)) return '+' + chiffres;
  if (/^[26]\d{8}$/.test(chiffres)) return '+237' + chiffres;
  return null;
}

/** Affichage lisible : « +237 6 90 00 00 00 » pour le Cameroun, brut sinon. */
export function formaterTelephone(e164: string): string {
  const m = /^\+237(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+237 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164;
}

/** Numéro pour les liens wa.me (sans « + »). */
export const pourWhatsApp = (e164: string) => e164.replace(/^\+/, '');

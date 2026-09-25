// Correspondance avec la base Airtable « Avenirs Application ».
// On utilise les identifiants de tables/champs (et non leurs noms) :
// renommer un champ dans Airtable ne casse donc pas l'application.

export const TABLES = {
  enfants: 'tblmvT383F5OsE6yP',
  evenements: 'tbljd0RoL8ppRJNY6',
};

export const ENFANT = {
  id: 'fldVmWDWDdS2Gz30j', // ID (numéro d'ordre)
  prenom: 'fld5F3x7zCCrRGU9b', // Prénom
  photo: 'fldZcpbBDr5YQUZFw', // Photo (pièce jointe)
  allergies: 'fldYpDpLH5SOkEdiL', // Allergies (texte, séparées par des virgules)
  acquises: 'fldQ8ShWJvmqjL1FJ', // Compétences Acquises (texte long)
  enCours: 'fldYu4MpsUphfKVMB', // Compétences en cours (texte long)
  livre: 'fldPH6JfM7TAkuAog', // Livre (titre)
  auteur: 'fldt3eRbAno8tuCra', // Auteur
  couverture: 'fld3Npy78mMJcHOdd', // Image de couverture (pièce jointe)
  evenements: 'fldloadNAj1yR6ugw', // Evenement (lien vers Événements)
};

export const EVENEMENT = {
  id: 'fldHrhIbyYnOqpEnq',
  titre: 'fldsugGu92sRDrAw3',
  dateDebut: 'fldBruJUGVdVdHPwM',
  heureDebut: 'fldpD6P0vfFxMtdS4',
  dateFin: 'flddBbhrOTixeWndu',
  heureFin: 'fldDB9txpuRipnV5J',
  lieu: 'fld3ivhz1UTrg8gqP',
  resume: 'fld6vzmnsikR67Y86',
  image: 'fldLbOFxiKyTy1i8J',
  enfants: 'fldld7ssvUECg2gyX', // Enfants (lien vers Enfants)
};

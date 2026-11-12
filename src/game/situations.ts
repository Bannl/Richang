/** Situations du quotidien : chaque rencontre puise ses phrases dans les themes indiques. */
export interface Situation {
  id: string;
  /** Nom court (carte du run). */
  en: string;
  fr: string;
  /** Interlocuteur (la personne a qui l'on parle). */
  person: { en: string; fr: string };
  /** Sujet de la discussion. */
  topic: { en: string; fr: string };
  themes: string[];
  boss?: boolean;
}

export const SITUATIONS: Situation[] = [
  { id: 'greetings', en: 'Greetings', fr: 'Salutations', person: { en: 'A passer-by', fr: 'Un passant' }, topic: { en: 'Saying hello', fr: 'Dire bonjour' }, themes: ['expressions'] },
  { id: 'small-talk', en: 'Small talk', fr: 'Bavardage', person: { en: 'A new acquaintance', fr: 'Une nouvelle connaissance' }, topic: { en: 'Small talk', fr: 'Bavardage' }, themes: ['pronoms', 'grammaire', 'expressions'] },
  { id: 'daily-life', en: 'Daily routine', fr: 'Le quotidien', person: { en: 'Your roommate', fr: 'Ton colocataire' }, topic: { en: 'Daily routine', fr: 'Le quotidien' }, themes: ['verbes', 'adjectifs', 'nombres-temps'] },
  { id: 'convenience-store', en: 'Convenience store', fr: 'Supérette', person: { en: 'Convenience store employee', fr: 'Employé de supérette' }, topic: { en: 'Buying a drink', fr: 'Acheter une boisson' }, themes: ['achats', 'nourriture'] },
  { id: 'night-market', en: 'Night market', fr: 'Marché de nuit', person: { en: 'Food stall vendor', fr: 'Vendeur du marché de nuit' }, topic: { en: 'Ordering street food', fr: 'Commander à manger' }, themes: ['nourriture'] },
  { id: 'drink-shop', en: 'Bubble tea shop', fr: 'Stand de thé', person: { en: 'Bubble tea clerk', fr: 'Serveur du stand de thé' }, topic: { en: 'Ordering bubble tea', fr: 'Commander un bubble tea' }, themes: ['nourriture', 'nombres-temps'] },
  { id: 'mrt', en: 'Taking the MRT', fr: 'Prendre le métro', person: { en: 'MRT station staff', fr: 'Agent du métro' }, topic: { en: 'Finding your way', fr: 'Trouver son chemin' }, themes: ['lieux-transport'] },
  { id: 'taxi', en: 'Taxi ride', fr: 'En taxi', person: { en: 'Taxi driver', fr: 'Chauffeur de taxi' }, topic: { en: 'Giving directions', fr: 'Indiquer le chemin' }, themes: ['lieux-transport', 'nombres-temps'] },
  { id: 'landlord', en: 'The landlord', fr: 'Le propriétaire', person: { en: 'Your landlord', fr: 'Ton propriétaire' }, topic: { en: 'Renting a flat', fr: 'Louer un appartement' }, themes: ['maison', 'achats'] },
  { id: 'neighbors', en: 'The neighbors', fr: 'Les voisins', person: { en: 'Your neighbour', fr: 'Ton voisin' }, topic: { en: 'Meeting the neighbours', fr: 'Faire connaissance' }, themes: ['personnes', 'maison', 'expressions'] },
  { id: 'clinic', en: 'At the clinic', fr: 'À la clinique', person: { en: 'The doctor', fr: 'Le médecin' }, topic: { en: 'Feeling unwell', fr: 'Un souci de santé' }, themes: ['corps-sante'] },
  { id: 'office', en: 'First day at work', fr: 'Premier jour au travail', person: { en: 'Your colleague', fr: 'Ton collègue' }, topic: { en: 'First day at work', fr: 'Premier jour au travail' }, themes: ['travail-etudes'] },
  { id: 'classroom', en: 'Chinese class', fr: 'Cours de chinois', person: { en: 'Chinese teacher', fr: 'Prof de chinois' }, topic: { en: 'In class', fr: 'En cours' }, themes: ['travail-etudes', 'grammaire'] },
  { id: 'family-dinner', en: 'Family dinner', fr: 'Dîner en famille', person: { en: "Your friend's mother", fr: "La mère de ton ami" }, topic: { en: 'Family dinner', fr: 'Dîner en famille' }, themes: ['personnes', 'nourriture'] },
  { id: 'weather', en: 'Weather talk', fr: 'Parler météo', person: { en: 'Building manager', fr: "Gardien de l'immeuble" }, topic: { en: 'Weather talk', fr: 'Parler météo' }, themes: ['nature', 'nombres-temps'] },
  { id: 'bank', en: 'At the bank', fr: 'À la banque', person: { en: 'Bank clerk', fr: 'Employé de banque' }, topic: { en: 'Opening an account', fr: 'Ouvrir un compte' }, themes: ['achats', 'nombres-temps'] },
  { id: "hardware-store", en: "Hardware store", fr: "Quincaillerie", person: { en: "Hardware store owner", fr: "Gérant de quincaillerie" }, topic: { en: "Fixing up the flat", fr: "Aménager l'appartement" }, themes: ["maison", "achats"] },
  { id: "moving-in", en: "Moving in", fr: "Emménagement", person: { en: "The mover", fr: "Le déménageur" }, topic: { en: "Moving in", fr: "Emménager" }, themes: ["maison"] },
  { id: "utilities", en: "Utilities", fr: "Les branchements", person: { en: "Utilities technician", fr: "Le technicien" }, topic: { en: "Water, power, internet", fr: "Eau, électricité, internet" }, themes: ["maison", "nombres-temps"] },
  { id: "airport", en: "At the airport", fr: "À l'aéroport", person: { en: "Airport staff", fr: "Agent de l'aéroport" }, topic: { en: "At the airport", fr: "À l'aéroport" }, themes: ["lieux-transport"] },
  { id: "directions", en: "Asking the way", fr: "Demander son chemin", person: { en: "A passer-by", fr: "Un passant" }, topic: { en: "Asking the way", fr: "Demander son chemin" }, themes: ["lieux-transport"] },
  { id: "scooter-rental", en: "Scooter rental", fr: "Louer un scooter", person: { en: "Scooter rental owner", fr: "Loueur de scooters" }, topic: { en: "Renting a scooter", fr: "Louer un scooter" }, themes: ["lieux-transport", "achats"] },
  { id: "post-office", en: "Post office", fr: "La poste", person: { en: "Postal clerk", fr: "Guichetier de la poste" }, topic: { en: "At the post office", fr: "À la poste" }, themes: ["lieux-transport", "achats"] },
  { id: "pharmacy", en: "Pharmacy", fr: "La pharmacie", person: { en: "Pharmacist", fr: "Le pharmacien" }, topic: { en: "At the pharmacy", fr: "À la pharmacie" }, themes: ["corps-sante", "achats"] },
  { id: "dentist", en: "The dentist", fr: "Le dentiste", person: { en: "The dentist", fr: "Le dentiste" }, topic: { en: "At the dentist", fr: "Chez le dentiste" }, themes: ["corps-sante"] },
  { id: "gym", en: "The gym", fr: "La salle de sport", person: { en: "Gym coach", fr: "Le coach" }, topic: { en: "At the gym", fr: "À la salle de sport" }, themes: ["corps-sante", "verbes"] },
  { id: "hiking", en: "Hiking", fr: "Randonnée", person: { en: "A fellow hiker", fr: "Un randonneur" }, topic: { en: "Hiking in the mountains", fr: "Randonnée en montagne" }, themes: ["nature"] },
  { id: "beach", en: "The beach", fr: "La plage", person: { en: "A beachgoer", fr: "Un vacancier" }, topic: { en: "A day at the beach", fr: "Une journée à la plage" }, themes: ["nature"] },
  { id: "making-friends", en: "Making friends", fr: "Se faire des amis", person: { en: "A classmate", fr: "Un camarade" }, topic: { en: "Making friends", fr: "Se faire des amis" }, themes: ["personnes", "expressions"] },
  { id: "job-interview", en: "Job interview", fr: "Entretien d'embauche", person: { en: "The recruiter", fr: "Le recruteur" }, topic: { en: "A job interview", fr: "Un entretien d'embauche" }, themes: ["travail-etudes"] },
  { id: "library", en: "The library", fr: "La bibliothèque", person: { en: "The librarian", fr: "Le bibliothécaire" }, topic: { en: "At the library", fr: "À la bibliothèque" }, themes: ["travail-etudes", "grammaire"] },
  { id: "clothes-shopping", en: "Clothes shopping", fr: "Acheter des vêtements", person: { en: "Clothing shop clerk", fr: "Le vendeur" }, topic: { en: "Buying clothes", fr: "Acheter des vêtements" }, themes: ["achats", "adjectifs"] },
  { id: "market", en: "The market", fr: "Le marché", person: { en: "Market vendor", fr: "Le maraîcher" }, topic: { en: "At the market", fr: "Au marché" }, themes: ["achats", "nourriture"] },
  { id: 'residency', en: 'Residency interview', fr: "Entretien de résidence", person: { en: 'Immigration officer', fr: "Agent de l'immigration" }, topic: { en: 'Residency interview', fr: 'Entretien de résidence' }, themes: [], boss: true },
];

export const SITUATION_BY_ID: Map<string, Situation> = new Map(SITUATIONS.map((s) => [s.id, s]));
export const BOSS_SITUATION = SITUATIONS.find((s) => s.boss)!;

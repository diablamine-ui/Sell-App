// Test « Indice d'Alignement » : questions, calcul du profil, résultats, exercices offerts et e-mails.
// Les exercices et les mécanismes viennent du livre « Le Pouvoir d'un Esprit Aligné » (Lamine Diabaté).
// Les textes sont écrits avec des espaces simples : frTypo() pose la typographie française à l'affichage.

export const BOOK_URL = '/ebook/esprit-aligne';

// Chapitres du livre cités dans le plan de lecture.
export const CHAPTERS = {
  1: 'Les trois centres du pouvoir intérieur',
  2: 'Les forces invisibles du désalignement',
  4: "L'art de la présence consciente",
  5: 'La foi, la vibration et la manifestation',
  6: "L'esprit aligné et la richesse",
  7: "L'esprit aligné et les relations",
  8: "L'esprit aligné et la mission de vie",
  9: "L'expansion : vivre dans le flux",
  10: 'Conclusion : ta pratique au-delà de la lecture',
};

// 15 affirmations, 5 par centre. Pour chacune : ce que la personne reconnaît (name),
// le mécanisme caché tiré du livre (mech), le sujet pour le plan de lecture (topic)
// et les chapitres qui y répondent (ch, le principal en premier).
// L'ordre d'affichage est mélangé côté navigateur.
export const QUESTIONS = [
  { id: 'm1', topic: "ta voix du « plus tard »", c: 'mental', t: "Je sais quoi faire. Mais dès que je commence quelque chose qui me ferait avancer, une envie de faire autre chose arrive, et je remets à plus tard. Et plus tard devient jamais.",
    name: "Tu remets à plus tard ce qui te ferait avancer",
    mech: "Ce n'est ni de la paresse ni un manque de volonté. C'est l'autosabotage : une partie de toi associe le changement à un danger, même quand c'est ce que tu désires, et elle invente une urgence ailleurs dès que tu approches du seuil.",
    ch: [2] },
  { id: 'm2', topic: "tes résolutions qui retombent", c: 'mental', t: "Je prends de bonnes résolutions avec beaucoup d'élan, et quelques jours plus tard, mes vieilles habitudes sont revenues.",
    name: 'Tes résolutions retombent au bout de quelques jours',
    mech: "Une résolution prise par la tête seule ne tient pas : ton cœur et ton corps n'ont rien signé. Au premier jour difficile, ils reprennent les commandes, et la vieille habitude revient. Le changement ne se produit pas dans un grand élan, il se produit dans les petits choix répétés.",
    ch: [1, 10] },
  { id: 'm3', topic: "ta foi qui n'ose pas encore agir", c: 'mental', t: "Je prie pour que ma vie change, mais j'agis comme si rien ne pouvait vraiment changer.",
    name: "Ta foi n'ose pas encore passer à l'acte",
    mech: "Ta bouche dit « ça va changer » pendant que le reste de ton être n'en est pas encore sûr. Or la foi n'est pas ce que tu dis, c'est la cohérence entre ce que tu penses, ce que tu ressens et ce que tu fais.",
    ch: [5] },
  { id: 'm4', topic: "la petite voix du « pas fait pour moi »", c: 'mental', t: "Face à ce que je veux vraiment construire, une petite voix me dit : « Ce n'est peut-être pas fait pour moi. »",
    name: "Une petite voix te dit que ce n'est pas fait pour toi",
    mech: "Cette voix parle avec ta propre voix, alors tu la crois. Ce n'est pourtant ni ta conscience ni ta raison : c'est le bruit de peurs anciennes, qui confond le « pas encore » avec le « jamais ».",
    ch: [8, 9] },
  { id: 'm5', topic: "ta croyance que l'argent finira par manquer", c: 'mental', t: "Je me surprends à penser que l'argent finira toujours par manquer, comme on me l'a appris.",
    name: "Tu penses que l'argent finira toujours par manquer",
    mech: "« L'argent ne tombe pas du ciel », « la vie est dure » : ces phrases te sont arrivées habillées en évidences, transmises avec amour par des gens qui les avaient reçues sans les choisir. Tu ne vis pas la croyance, tu vis ses conséquences, année après année.",
    ch: [6, 2] },
  { id: 'c1', topic: "tes oui qui voulaient dire non", c: 'coeur', t: "Je dis oui pour ne pas décevoir, puis je m'en veux de ne pas avoir dit non.",
    name: 'Tu dis oui quand tout en toi voulait dire non',
    mech: "Ce n'est pas de la gentillesse, c'est la peur du conflit et le besoin d'être apprécié. Chaque oui de trop te coûte un peu d'énergie, et un peu du respect que tu te dois.",
    ch: [7] },
  { id: 'c2', topic: "les déceptions qui se répètent", c: 'coeur', t: "Je revis les mêmes déceptions avec des personnes différentes, comme si l'histoire se répétait.",
    name: 'Les mêmes déceptions reviennent avec d\'autres visages',
    mech: "Les personnes qui entrent dans ta vie n'arrivent pas par hasard : elles arrivent à l'intersection de ce que tu portes. Tant qu'une blessure n'est pas regardée en face, elle rejoue la même scène avec d'autres acteurs.",
    ch: [7] },
  { id: 'c3', topic: "le besoin de prouver ta valeur", c: 'coeur', t: "J'ai l'impression de devoir prouver ma valeur pour mériter l'amour ou le respect.",
    name: 'Tu crois devoir prouver ta valeur pour être aimé',
    mech: "C'est l'amour qu'on apprend quand l'affection était conditionnelle : être aimé dépendait de ce qu'on faisait, pas de ce qu'on était. Cet amour-là s'épuise à être ce que l'autre voudrait.",
    ch: [7] },
  { id: 'c4', topic: "ta gêne à demander ce que tu vaux", c: 'coeur', t: "Annoncer mon prix ou demander ce que je vaux me met mal à l'aise, alors je cède ou je baisse.",
    name: 'Tu as du mal à demander ce que tu vaux',
    mech: "Derrière la gêne se cache souvent une vieille croyance : demander davantage, ce serait passer pour quelqu'un qui se croit supérieur. Ta valeur finit alors par dépendre de l'approbation des autres.",
    ch: [6] },
  { id: 'c5', topic: "l'argent qui repart dès qu'il arrive", c: 'coeur', t: "Quand je gagne un peu plus que d'habitude, l'argent repart presque aussitôt : une dépense, un imprévu, quelqu'un qui en a besoin.",
    name: "L'argent repart dès qu'il arrive",
    mech: "Tu avances jusqu'à un certain seuil, toujours le même, puis tu recules : c'est le même frein qui s'active au même endroit. Une partie de toi ne se sent pas encore digne de recevoir, alors elle laisse partir ce qui arrive.",
    ch: [6, 2] },
  { id: 'k1', topic: "la lourdeur au moment d'agir", c: 'corps', t: "Au moment d'agir, une lourdeur ou une fatigue soudaine me tombe dessus, alors que j'étais motivé quelques minutes avant.",
    name: "Une lourdeur te tombe dessus au moment d'agir",
    mech: "Ton corps n'est pas paresseux : il exécute l'ordre de prudence que lui envoie la partie de toi qui a peur. Te forcer ne marche pas. Il faut la rassurer, pas à pas, jusqu'à ce que le seuil recule.",
    ch: [2] },
  { id: 'k2', topic: "ta course sans fin", c: 'corps', t: "Je cours sans arrêt, et même quand j'obtiens quelque chose, je n'arrive pas à en profiter : je pense déjà à la suite.",
    name: "Tu cours sans jamais profiter de ce que tu obtiens",
    mech: "C'est la posture du chasseur : il attrape, mais il ne se repose jamais, parce qu'il court déjà après la proie suivante. L'abondance n'est pas dans le chiffre, elle est dans la direction du regard.",
    ch: [6] },
  { id: 'k3', topic: "ton esprit ailleurs quand tu es avec les tiens", c: 'corps', t: "Je suis assis avec ceux que j'aime, mais mon esprit est ailleurs, et je m'en rends compte trop tard.",
    name: 'Ton esprit est ailleurs quand tu es avec les tiens',
    mech: "Tu es là sans être là. Et pendant que ton esprit court devant, les moments qui comptent passent sans que tu les habites.",
    ch: [4] },
  { id: 'k4', topic: "tes tensions dans le corps", c: 'corps', t: "Je porte des tensions dans le corps sans jamais me demander ce qu'elles essaient de me dire.",
    name: 'Tes tensions parlent et personne ne les écoute',
    mech: "Le corps signale ce que la tête refuse d'entendre. Une épaule crispée ou une gorge serrée, c'est une information, pas un détail.",
    ch: [1] },
  { id: 'k5', topic: "ton réflexe du téléphone", c: 'corps', t: "Même seul et au calme, j'ai du mal à rester quelques minutes sans prendre mon téléphone.",
    name: "Tu n'arrives plus à rester sans ton téléphone",
    mech: "Un esprit constamment sollicité n'a jamais l'espace de se déposer. Et un esprit qui ne se dépose jamais n'entend plus ce qui compte vraiment.",
    ch: [4, 2] },
];
export const SCALE = ['Jamais', 'Parfois', 'Souvent', 'Toujours'];
export const CENTRES = { mental: 'Mental', coeur: 'Cœur', corps: 'Corps' };
const MAX = 15; // 5 affirmations de 0 à 3 par centre

// Profil : le centre au score le plus haut ; mixte si les deux premiers sont presque égaux ;
// aligné si toutes les réponses restent basses.
export function scoreAnswers(answers) {
  const s = { mental: 0, coeur: 0, corps: 0 };
  for (const q of QUESTIONS) {
    const v = answers[q.id];
    if (!Number.isInteger(v) || v < 0 || v > 3) return null;
    s[q.c] += v;
  }
  const order = Object.keys(s).sort((a, b) => s[b] - s[a]);
  const [a, b] = order;
  let profile;
  if (s[a] <= 5) profile = 'aligne';
  else if (s[a] - s[b] <= 1) profile = 'mixte';
  else profile = a;
  return { scores: s, profile, top: [a, b], max: MAX };
}

// Exercices offerts : texte intégral du livre, découpé en blocs (p : paragraphe, h : intertitre, q : citation, l : point de liste).
export const EXERCISES = {
  accord: {
    title: "L'accord intérieur",
    chapter: 'Chapitre 1',
    blocks: [
      ['p', "À faire aujourd'hui, pas demain, pas « quand tu auras le temps »."],
      ['p', "Trouve cinq minutes de silence complet : ni musique, ni podcast, ni fond sonore."],
      ['p', "Assieds-toi, pose tes deux mains à plat sur tes genoux et ferme les yeux."],
      ['p', "Trois grandes respirations, lentes, profondes, complètes. Inspire par le nez jusqu'à ce que ton ventre se soulève. Expire par la bouche jusqu'à ce qu'il n'y ait plus rien à expirer. Trois fois."],
      ['p', "Puis pose-toi ces trois questions, une par une, honnêtement, sans chercher la bonne réponse. Il n'y a pas de bonne réponse, seulement ta réponse vraie."],
      ['l', "**Mental** : quelle est la pensée qui tourne en boucle dans ma tête en ce moment ? Depuis combien de temps est-elle là ? Est-ce qu'elle m'aide à avancer, ou est-ce qu'elle me retient là où je suis ?"],
      ['l', "**Cœur** : si j'enlève la réponse que je suis censé donner, la réponse socialement acceptable, logiquement défendable, qu'est-ce que je ressens vraiment, là, maintenant, dans ma poitrine ?"],
      ['l', "**Corps** : où est la tension dans mon corps en ce moment précis ? Dans les épaules ? La gorge ? Le bas du dos ? Le ventre ? Cette tension essaie de me dire quelque chose : quoi ?"],
      ['p', "Note ce que tu trouves, non pour le résoudre tout de suite, mais simplement pour le voir."],
      ['p', "Car on ne peut pas aligner ce qu'on n'a pas encore reconnu. Et ce qu'on reconnaît clairement commence déjà à se transformer."],
      ['p', "Ce simple regard, honnête, sans jugement, sans précipitation, est déjà le premier acte de ta symphonie intérieure."],
    ],
  },
  ombres: {
    title: "L'inventaire des ombres",
    chapter: 'Chapitre 2',
    blocks: [
      ['p', "Il y a une règle pour cet exercice : l'honnêteté totale. La version vraie, pas la version polie."],
      ['p', "Prends un carnet et un stylo, surtout pas ton téléphone."],
      ['p', "Accorde-toi vingt minutes de silence complet."],
      ['p', "Puis réponds à ces questions, sans te censurer, sans chercher la bonne réponse :"],
      ['l', "Complète cette phrase honnêtement : « Dans ma famille, on m'a appris que pour réussir, il fallait… » Maintenant demande-toi : est-ce que je choisis vraiment de croire ça aujourd'hui ? Ou est-ce que je l'ai simplement hérité sans jamais l'examiner ?"],
      ['l', "Pense à un projet, une ambition, un désir que tu repousses depuis longtemps. Qu'est-ce qui se passerait de si terrible si tu allais vraiment jusqu'au bout ? Nomme la peur précisément."],
      ['l', "Quand as-tu ri aux éclats pour la dernière fois, vraiment, et pas par politesse ? Quand as-tu chanté, dansé, couru, ou fait quelque chose uniquement parce que ça te faisait du bien ? Si tu dois chercher longtemps, c'est un signal."],
      ['p', "Ne cherche pas à résoudre ce que tu trouves, seulement à le voir et à lui donner un nom."],
      ['p', "Ce que tu peux nommer, tu peux le traverser. Ce qui reste dans l'ombre te gouverne à ton insu."],
    ],
  },
  presence: {
    title: 'Cinq minutes de vraie présence',
    chapter: 'Chapitre 4',
    blocks: [
      ['p', "Cinq minutes, aujourd'hui, pas demain."],
      ['p', "Non parce que cinq minutes vont tout changer d'un coup, mais parce que cinq minutes tenues chaque jour creusent, avec le temps, quelque chose qu'aucune session isolée de deux heures ne peut atteindre. La régularité est la seule discipline qui compte ici."],
      ['h', "L'espace"],
      ['p', "Trouve un endroit où tu ne seras pas interrompu. Assieds-toi, dos droit, sans rigidité. Pose tes mains sur tes genoux, paumes ouvertes vers le ciel. Ce geste n'est pas anodin : une main fermée retient, une main ouverte reçoit. Commence par choisir de recevoir."],
      ['h', 'La respiration'],
      ['p', "Inspire lentement par le nez en comptant jusqu'à quatre, en laissant le ventre se soulever avant la poitrine. Retiens une seconde. Expire par la bouche en comptant jusqu'à huit, longuement, jusqu'au bout du souffle. Trois fois. Puis laisse ta respiration trouver son propre rythme naturel."],
      ['h', "L'observation"],
      ['p', "Quand une pensée arrive, et elle arrivera forcément, ne la combats pas, ne la poursuis pas non plus. Imagine qu'elle est écrite sur un nuage qui traverse le ciel de ton esprit. Tu la vois, tu la reconnais, tu la laisses passer. Puis tu reviens à ta respiration, sans frustration, sans jugement, comme on revient chez soi après une courte promenade."],
      ['p', 'Chaque retour est une victoire.'],
      ['h', 'La question finale'],
      ['p', "Trente secondes avant d'ouvrir les yeux, pose-toi cette question depuis le calme que tu viens de créer, depuis ta poitrine plutôt que depuis ta tête :"],
      ['q', "« Si je ne devais faire qu'une seule chose aujourd'hui qui soit vraiment alignée avec qui je suis et ce que je construis, quelle serait-elle ? »"],
      ['p', "Laisse la réponse venir d'elle-même. Une part de toi la connaît depuis longtemps ; c'est le silence qui te manquait pour l'entendre."],
      ['p', 'Puis ouvre les yeux et fais cette chose, une seule, aujourd\'hui.'],
    ],
  },
  miroir: {
    title: 'Le miroir honnête',
    chapter: 'Chapitre 7',
    blocks: [
      ['p', "Cet exercice ne fonctionne que si tu refuses de te donner le beau rôle."],
      ['h', 'Version immédiate (3 minutes)'],
      ['p', "Pense à une personne qui t'irrite en ce moment. Pose-toi honnêtement cette seule question : « Est-ce que ce qui me dérange chez elle existe, sous une forme différente, en moi ? » Ne cherche pas la réponse parfaite, juste la réponse honnête."],
      ['h', 'Version approfondie (20 minutes)'],
      ['p', "**Choisir le miroir.** Pense à une personne qui t'irrite, te blesse ou te pose problème en ce moment. Note ce qui, précisément, te dérange chez elle. Sois précis : quel comportement ? quelle attitude ? quelle façon d'être ?"],
      ['p', "**Regarder le reflet.** Pose-toi ces questions honnêtement, sans te défendre :"],
      ['l', "« Est-ce que ce comportement existe, sous une forme différente, en moi ? »"],
      ['l', "« Est-ce qu'il touche une blessure ancienne (un abandon, une trahison, un manque de reconnaissance) qui n'a rien à voir avec cette personne ? »"],
      ['l', "« Qu'est-ce que cette irritation me dit sur ce dont j'ai encore besoin pour grandir ? »"],
      ['p', "**L'acte de libération.** Ferme les yeux. Respire profondément. Visualise cette personne devant toi, non pas avec ce qu'elle t'a fait, mais avec ce qu'elle est : un être humain imparfait, portant ses propres blessures, faisant de son mieux avec ce qu'elle a. Et depuis cet endroit, pour toi et non pour elle, prononce intérieurement ces mots :"],
      ['q', "« Je reconnais ce que cette relation m'a révélé. Je choisis de libérer ce que je portais. Je reprends mon énergie. Je reprends mon pouvoir. »"],
      ['p', 'Puis ouvre les yeux.'],
    ],
  },
  finance: {
    title: 'Le miroir financier',
    chapter: 'Chapitre 6',
    blocks: [
      ['p', "Cet exercice demande une honnêteté totale. Sans jugement, sans culpabilité. Juste un regard clair sur ce qui est."],
      ['p', "Prends un carnet et un stylo, pas ton téléphone."],
      ['h', 'Première partie : le diagnostic'],
      ['p', "Réponds honnêtement à ces questions. Prends le temps qu'il faut."],
      ['l', "« Dans ma famille, l'argent était associé à quoi ? À la dignité ? À la honte ? À la lutte ? À la peur ? À la liberté ? »"],
      ['l', "« Quand je parle de mes prix ou de mes tarifs, qu'est-ce que je ressens dans mon corps ? De la confiance ? De la gêne ? De la peur du jugement ? »"],
      ['l', "« La dernière fois qu'une belle opportunité financière s'est présentée, qu'est-ce qui s'est passé en moi ? Ai-je sauté dessus, ou ai-je trouvé des raisons de douter ? »"],
      ['l', "« Est-ce que je reçois facilement les compliments, l'argent, l'aide, la reconnaissance, ou est-ce que quelque chose en moi minimise, refuse ou se sent immédiatement redevable ? »"],
      ['h', 'Deuxième partie : la réécriture'],
      ['p', "Pour chaque croyance que tu as identifiée, écris la phrase opposée. Non comme une affirmation vide, mais comme une vérité que tu choisis consciemment de porter à partir d'aujourd'hui."],
      ['p', "Par exemple : si tu as identifié « je ne mérite pas de demander plus », la phrase opposée n'est pas « je mérite tout », mais quelque chose comme « ma valeur ne dépend pas de l'approbation des autres, parce que… » et tu complètes avec ce qui est vrai pour toi. C'est dans ce « parce que » que la nouvelle croyance prend racine."],
      ['h', "Troisième partie : l'acte"],
      ['p', "Identifie une décision financière que tu repousses depuis trop longtemps. Elle ressemble peut-être à l'une de celles-ci : augmenter tes tarifs ou ton prix de vente ; lancer un produit ou un service que tu as préparé mais jamais encore proposé ; demander une augmentation que tu sais mériter ; investir dans une formation ou un outil qui changerait la qualité de ton travail ; refuser une mission sous-payée parce qu'elle ne correspond plus à ce que tu vaux."],
      ['p', "Tu sais laquelle c'est pour toi. Tu la reconnais au léger malaise qu'elle crée quand tu la lis."],
      ['p', "Prends cette décision aujourd'hui."],
    ],
  },
};

// Résultats. « mixte » reçoit les noms des deux centres en tête.
export const PROFILES = {
  mental: {
    title: 'Ton mental tient le volant',
    text: [
      "Ta tête sait. Elle sait ce qu'il faudrait changer, elle prend même les bonnes résolutions. Mais au moment de passer à l'acte, une autre partie de toi freine : une envie de faire autre chose, un « plus tard », une petite voix qui doute. Ce n'est pas de la paresse. Ce sont des croyances que tu n'as jamais choisies, héritées de ta famille ou d'une vieille déception, qui protègent ce que tu connais déjà.",
      "Ce que ça produit : des projets qui restent dans ta tête, un nouveau départ chaque lundi, et cette fatigue particulière de celui qui sait beaucoup et avance peu.",
    ],
    exercise: 'ombres',
  },
  coeur: {
    title: 'Ton cœur porte ce que tu ne dis pas',
    text: [
      "Tu donnes beaucoup. Tu fais attention aux autres, tu évites de décevoir, tu gardes pour toi ce qui pourrait déranger. De l'extérieur, tout va bien. À l'intérieur, il y a des oui qui étaient des non, des déceptions qui se répètent, et ce besoin discret de prouver ta valeur pour mériter ta place.",
      "Ce que ça produit : une fatigue que personne ne voit, des relations où tu reçois moins que tu ne donnes, et souvent un rapport difficile à l'argent : tu n'oses pas demander ce que tu vaux, et ce qui arrive repart vite, comme si une partie de toi ne se sentait pas le droit de le garder.",
    ],
    exercise: 'miroir',
  },
  corps: {
    title: "Ton corps parle, et tu ne l'écoutes pas",
    text: [
      "Tu avances vite. Ton agenda est plein, ton téléphone jamais loin, et ton corps suit comme il peut. Il te prévient pourtant : une épaule qui se crispe, une fatigue qui ne part plus, une lourdeur qui tombe au moment précis où tu allais agir. Et quand tu es enfin avec ceux que tu aimes, ton esprit est encore ailleurs.",
      "Ce que ça produit : des journées pleines dont il ne reste rien, des victoires dont tu ne profites pas, et une énergie qui s'épuise avant d'arriver à ce qui compte vraiment.",
    ],
    exercise: 'presence',
    note: "Si une douleur ou une fatigue dure, parles-en aussi à un professionnel de santé.",
  },
  mixte: {
    title: 'Deux centres tirent en même temps',
    text: [
      "Chez toi, deux centres sont en désaccord presque à égalité : {A} et {B}. C'est le signe que le tiraillement ne vient pas d'un seul endroit. Ce que tu penses et ce que tu ressens, ou ce que tu ressens et ce que tu fais, ne vont pas dans la même direction.",
      "Ce que ça produit : l'impression d'avancer avec le frein à main serré. Assez pour bouger, jamais assez pour aller où tu veux, et une énergie qui part dans la résistance plutôt que dans le mouvement.",
    ],
    exercise: 'accord',
  },
  aligne: {
    title: 'Tes trois centres se parlent',
    text: [
      "Bonne nouvelle : tes réponses montrent peu de désaccord entre ce que tu penses, ce que tu ressens et ce que tu fais. Tu sais revenir à ton centre, et ça se voit.",
      "Garde simplement en tête que l'alignement n'est pas un état acquis une fois pour toutes, mais un retour qu'on pratique. Les jours de pression, c'est la pratique qui fait la différence.",
    ],
    exercise: 'accord',
    further: "Les chapitres 8 et 9, sur la mission de vie et le flux, sont écrits pour ceux qui sont déjà centrés et veulent aller plus loin.",
  },
};

// Analyse personnelle : ce que la personne a reconnu (Souvent ou Toujours), le mécanisme
// derrière chaque réponse, et les chapitres qui y répondent, regroupés en plan de lecture.
export function profileView(p, top, answers) {
  const P = PROFILES[p];
  const fill = (s) => s.replace('{A}', CENTRES[top[0]].toLowerCase()).replace('{B}', CENTRES[top[1]].toLowerCase());
  const strong = QUESTIONS.filter((q) => (answers[q.id] || 0) >= 2)
    .sort((a, b) => answers[b.id] - answers[a.id]);
  const recognized = strong.slice(0, 6).map((q) => ({ id: q.id, name: q.name, mech: q.mech, always: answers[q.id] === 3 }));
  const byCh = {};
  // Chaque réponse forte renvoie à son chapitre principal.
  strong.forEach((q) => { const n = q.ch[0]; (byCh[n] = byCh[n] || []).push(q.topic); });
  const plan = Object.keys(byCh).map(Number).sort((a, b) => a - b)
    .map((n) => ({ ch: n === 10 ? 'Conclusion' : 'Chapitre ' + n, title: n === 10 ? 'Ta pratique au-delà de la lecture' : CHAPTERS[n], items: byCh[n] }));
  // Exercice : le miroir financier quand l'argent pèse plus que les relations dans les réponses du cœur.
  let exercise = P.exercise;
  if ((p === 'coeur' || (p === 'mixte' && top.includes('coeur'))) && (answers.c4 || 0) + (answers.c5 || 0) >= ((answers.c1 || 0) + (answers.c2 || 0) + (answers.c3 || 0)) * 2 / 3) exercise = 'finance';
  return {
    key: p, title: P.title, text: P.text.map(fill), note: P.note || '',
    recognized, plan, further: P.further || '',
    exercise: EXERCISES[exercise],
  };
}

// Typographie française : apostrophe courbe, espaces insécables avant : ; ? ! et dans les guillemets.
export function frTypo(s) {
  return String(s)
    .replace(/'/g, '’')
    .replace(/\s*([;!?])/g, ' $1')
    .replace(/\s+:(?=\s|$)/g, ' :')
    .replace(/«\s*/g, '« ')
    .replace(/\s*»/g, ' »');
}

function exerciseText(ex) {
  return ex.blocks.map(([k, t]) => {
    const s = frTypo(t.replace(/\*\*/g, ''));
    if (k === 'h') return s.toUpperCase();
    if (k === 'l') return '- ' + s;
    return s;
  }).join('\n\n');
}
function planText(view) {
  if (!view.plan.length) return frTypo(view.further);
  return view.plan.map((x) => frTypo(`${x.ch}, ${x.title} : ${x.items.join(', ')}.`)).join('\n');
}

// ───────────── E-mails ─────────────
// J0 : résultat, analyse et exercice. J2 : une image du livre. J5 : la proposition du livre.
export function mailJ0(lead, view, links) {
  const body = [
    `Bonjour ${lead.prenom},`,
    frTypo(`Voici le résultat de ton test d'alignement : ${view.title}.`),
    ...view.text.map(frTypo),
    view.recognized.length ? frTypo('Ce que tu as reconnu toi-même, et ce qui se passe vraiment :') : '',
    ...view.recognized.map((r) => frTypo(`- ${r.name}. ${r.mech}`)),
    frTypo(`Comme promis, voici ton exercice, tiré du livre (${view.exercise.chapter}) : ${view.exercise.title}.`),
    exerciseText(view.exercise),
    frTypo("Fais-le aujourd'hui, pas « quand tu auras le temps ». C'est là que tout commence."),
    view.note ? frTypo(view.note) : '',
    frTypo(view.plan.length ? 'Ton plan de lecture dans Le Pouvoir d\'un Esprit Aligné :' : 'Pour aller plus loin :'),
    planText(view),
    frTypo('Le livre est ici :') + ' ' + links.book,
    'Lamine Diabaté',
    frTypo('Tu recevras deux autres e-mails de ma part cette semaine. Si tu ne veux plus en recevoir :') + ' ' + links.stop,
  ].filter(Boolean);
  return { subject: frTypo(`Ton résultat : ${view.title}`), text: body.join('\n\n') };
}

export function mailJ2(lead, view, links) {
  const first = view.recognized[0];
  const body = [
    `Bonjour ${lead.prenom},`,
    frTypo("Laisse-moi te partager une image. C'est celle qui ouvre le premier chapitre de mon livre."),
    frTypo("Imagine un homme assis dans une voiture puissante, moteur de course, carburant plein, route dégagée devant lui. Mais il conduit avec le frein à main à moitié serré, juste assez pour que la voiture avance quand même, lentement, difficilement, en brûlant deux fois plus d'énergie qu'il ne devrait. Il appuie plus fort sur l'accélérateur, la voiture résiste. Il appuie encore, elle résiste encore. Et lui, il se dit que la vie est dure, que la route est longue, que peut-être il n'est pas fait pour aller vite."),
    frTypo("Il n'a jamais pensé à regarder le frein à main."),
    frTypo("Cette image, c'est la vie de la plupart d'entre nous. Ni la puissance ni la volonté ne nous manquent. Mais on avance avec quelque chose de serré en nous, quelque chose qu'on ne voit pas, et qui consume chaque jour une force considérable."),
    first
      ? frTypo(`Dans ton test, tu as reconnu ceci : ${first.name.charAt(0).toLowerCase() + first.name.slice(1)}. C'est peut-être ton frein à main en ce moment. As-tu fait l'exercice que je t'ai envoyé ? Si ce n'est pas encore fait, ce soir suffit. Quelques minutes, un carnet, et de l'honnêteté.`)
      : frTypo("Ton test montre que ton frein à main est plutôt desserré en ce moment. Garde le réflexe de vérifier, surtout les jours de pression : c'est à ça que sert l'exercice que je t'ai envoyé."),
    frTypo('Le livre complet est ici, si tu veux aller plus loin :') + ' ' + links.book,
    'Lamine Diabaté',
    frTypo('Pour ne plus recevoir mes e-mails :') + ' ' + links.stop,
  ];
  return { subject: 'Le frein à main', text: body.join('\n\n') };
}

export function mailJ5(lead, view, links) {
  const body = [
    `Bonjour ${lead.prenom},`,
    frTypo("Il y a quelques jours, tu as fait le test d'alignement. Je t'écris une dernière fois pour te parler du livre d'où viennent ce test et ton exercice : Le Pouvoir d'un Esprit Aligné."),
    frTypo("Je l'ai écrit pour une raison simple : on peut savoir exactement ce qu'il faut faire, et ne pas le faire. Pas par paresse, mais parce que la tête, le cœur et le corps tirent dans trois directions différentes. Le livre t'aide à les remettre d'accord, un centre après l'autre."),
    frTypo("Ce que tu y trouves : neuf chapitres, chacun suivi d'un exercice à faire le jour même, comme celui que tu as reçu. Mes histoires vraies, aussi : l'embouteillage du jeudi, la question de mon fils restée sans réponse au déjeuner du dimanche, le prix de mes livres que je n'osais pas annoncer."),
    view.plan.length ? frTypo("D'après tes réponses, voici par où commencer :") : '',
    view.plan.length ? planText(view) : '',
    frTypo('Il coûte 5 000 F, en PDF, et tu le télécharges juste après le paiement (Wave, Orange Money, MTN ou carte) :') + ' ' + links.book,
    frTypo("Si ce n'est pas le moment, garde simplement ton exercice. Il t'appartient, et il fera son travail."),
    'Lamine Diabaté',
    frTypo('Pour ne plus recevoir mes e-mails :') + ' ' + links.stop,
  ].filter(Boolean);
  return { subject: frTypo(`${lead.prenom}, la suite de ton test`), text: body.join('\n\n') };
}

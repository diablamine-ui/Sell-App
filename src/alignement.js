// Test « Indice d'Alignement » : questions, calcul du profil, résultats, exercices offerts et e-mails.
// Les exercices sont repris tels quels du livre « Le Pouvoir d'un Esprit Aligné » (Lamine Diabaté).
// Les textes sont écrits avec des espaces simples : frTypo() pose la typographie française à l'affichage.

export const BOOK_URL = '/ebook/esprit-aligne';

// Une phrase par question, écrite en « je ». L'ordre d'affichage est mélangé côté navigateur.
export const QUESTIONS = [
  { id: 'm1', c: 'mental', t: "Je réfléchis tellement à ce que je devrais changer que je finis par ne rien commencer." },
  { id: 'm2', c: 'mental', t: "Quand une belle occasion se présente, je trouve vite des raisons de croire que je n'y arriverai pas." },
  { id: 'm3', c: 'mental', t: "J'ai du mal à accepter qu'une situation ne se déroule pas comme je l'avais prévu." },
  { id: 'm4', c: 'mental', t: "Face à ce que je veux vraiment construire, une petite voix me dit : « Ce n'est peut-être pas fait pour moi. »" },
  { id: 'c1', c: 'coeur', t: "Je dis oui pour ne pas décevoir, puis je m'en veux de ne pas avoir dit non." },
  { id: 'c2', c: 'coeur', t: "Il m'arrive de faire comme si j'avais oublié une blessure, alors qu'elle me pèse encore." },
  { id: 'c3', c: 'coeur', t: "J'ai souvent besoin de prouver ma valeur pour me sentir digne d'être aimé ou respecté." },
  { id: 'c4', c: 'coeur', t: "Quand on m'aide ou qu'on me fait un compliment, j'ai du mal à recevoir sans me justifier ou me sentir redevable." },
  { id: 'k1', c: 'corps', t: "Même quand mon corps me montre qu'il a besoin de ralentir, je continue comme si de rien n'était." },
  { id: 'k2', c: 'corps', t: "Je suis assis avec ceux que j'aime, mais mon esprit est ailleurs, et je m'en rends compte trop tard." },
  { id: 'k3', c: 'corps', t: "Je porte des tensions dans le corps sans jamais me demander ce qu'elles essaient de me dire." },
  { id: 'k4', c: 'corps', t: "Même seul et au calme, j'ai du mal à rester quelques minutes sans prendre mon téléphone." },
];
export const SCALE = ['Pas du tout moi', 'Un peu', 'Beaucoup', "C'est tout à fait moi"];
export const CENTRES = { mental: 'Mental', coeur: 'Cœur', corps: 'Corps' };

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
  if (s[a] <= 4) profile = 'aligne';
  else if (s[a] - s[b] <= 1) profile = 'mixte';
  else profile = a;
  return { scores: s, profile, top: [a, b] };
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
};

// Résultats. « mixte » reçoit les noms des deux centres en tête.
export const PROFILES = {
  mental: {
    title: 'Ton mental tient le volant',
    text: [
      "Ta tête travaille sans arrêt. Elle analyse, anticipe, compare, et finit souvent par décider à ta place qu'il vaut mieux attendre. Ce n'est pas un manque d'intelligence, c'est presque l'inverse : tu réfléchis tellement que l'action n'arrive plus à passer. Et derrière ces raisonnements se cache souvent une croyance que tu n'as jamais choisie, héritée de ta famille ou d'une vieille déception, qui murmure que ce n'est pas pour toi.",
      "Ce que ça produit : des projets qui restent dans ta tête, des occasions qu'on laisse passer en se disant qu'on n'est pas encore prêt, et cette fatigue particulière de celui qui pense beaucoup et avance peu.",
    ],
    exercise: 'ombres',
    further: "Dans le livre, le chapitre 2 remonte jusqu'à ces croyances héritées, et le chapitre 9 t'apprend à lâcher le contrôle sans renoncer à agir.",
  },
  coeur: {
    title: 'Ton cœur porte ce que tu ne dis pas',
    text: [
      "Tu donnes beaucoup. Tu fais attention aux autres, tu évites de décevoir, tu gardes pour toi ce qui pourrait déranger. De l'extérieur, tout va bien. À l'intérieur, il y a des oui qui étaient des non, une blessure que tu fais semblant d'avoir oubliée, et ce besoin discret de prouver ta valeur pour mériter ta place.",
      "Ce que ça produit : une fatigue que personne ne voit, des rancunes qui colorent tes nouvelles relations, et une difficulté à recevoir, même quand la vie t'offre ce que tu as demandé.",
    ],
    exercise: 'miroir',
    further: "Dans le livre, le chapitre 7 parle des relations et du pardon qui libère, et le chapitre 6 de l'art de recevoir sans peur.",
  },
  corps: {
    title: 'Ton corps parle, et tu ne l\'écoutes pas',
    text: [
      "Tu avances vite. Ton agenda est plein, ton téléphone jamais loin, et ton corps suit comme il peut. Il te prévient pourtant : une épaule qui se crispe, un ventre qui se noue, une fatigue qui ne part plus. Et quand tu es enfin avec ceux que tu aimes, ton esprit est encore ailleurs.",
      "Ce que ça produit : des journées pleines dont il ne reste rien, des moments importants traversés sans être vécus, et une énergie qui s'épuise avant d'arriver à ce qui compte vraiment.",
    ],
    exercise: 'presence',
    further: "Dans le livre, le chapitre 4 est consacré à la présence, et le chapitre 1 t'aide à comprendre ce que ton corps dit de tes deux autres centres.",
    note: "Si une douleur ou une fatigue dure, parles-en aussi à un professionnel de santé.",
  },
  mixte: {
    title: 'Deux centres tirent en même temps',
    text: [
      "Chez toi, deux centres sont en désaccord presque à égalité : {A} et {B}. C'est le signe que le tiraillement ne vient pas d'un seul endroit. Ce que tu penses et ce que tu ressens, ou ce que tu ressens et ce que tu fais, ne vont pas dans la même direction.",
      "Ce que ça produit : l'impression d'avancer avec le frein à main serré. Assez pour bouger, jamais assez pour aller où tu veux, et une énergie qui part dans la résistance plutôt que dans le mouvement.",
    ],
    exercise: 'accord',
    further: "Dans le livre, le chapitre 1 décrit les trois centres et la façon dont ils se contredisent, et chaque chapitre suivant en remet un d'accord avec les deux autres.",
  },
  aligne: {
    title: 'Tes trois centres se parlent',
    text: [
      "Bonne nouvelle : tes réponses montrent peu de désaccord entre ce que tu penses, ce que tu ressens et ce que tu fais. Tu sais revenir à ton centre, et ça se voit.",
      "Garde simplement en tête que l'alignement n'est pas un état acquis une fois pour toutes, mais un retour qu'on pratique. Les jours de pression, c'est la pratique qui fait la différence.",
    ],
    exercise: 'accord',
    further: "Dans le livre, les chapitres 8 et 9, sur la mission de vie et le flux, sont écrits pour ceux qui sont déjà centrés et veulent aller plus loin.",
  },
};

export function profileView(p, top) {
  const P = PROFILES[p];
  const fill = (s) => s.replace('{A}', CENTRES[top[0]].toLowerCase()).replace('{B}', CENTRES[top[1]].toLowerCase());
  return { key: p, title: P.title, text: P.text.map(fill), further: P.further, note: P.note || '', exercise: EXERCISES[P.exercise] };
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

// ───────────── E-mails ─────────────
// J0 : résultat et exercice. J2 : une image du livre. J5 : la proposition du livre.
export function mailJ0(lead, view, links) {
  const body = [
    `Bonjour ${lead.prenom},`,
    frTypo(`Voici le résultat de ton test d'alignement : ${view.title}.`),
    ...view.text.map(frTypo),
    frTypo(`Comme promis, voici ton exercice, tiré du livre (${view.exercise.chapter}) : ${view.exercise.title}.`),
    exerciseText(view.exercise),
    frTypo("Fais-le aujourd'hui, pas « quand tu auras le temps ». C'est là que tout commence."),
    view.note ? frTypo(view.note) : '',
    frTypo(`${view.further} Tu peux le découvrir ici :`) + ' ' + links.book,
    'Lamine Diabaté',
    frTypo('Tu recevras deux autres e-mails de ma part cette semaine. Si tu ne veux plus en recevoir :') + ' ' + links.stop,
  ].filter(Boolean);
  return { subject: frTypo(`Ton résultat : ${view.title}`), text: body.join('\n\n') };
}

export function mailJ2(lead, view, links) {
  const body = [
    `Bonjour ${lead.prenom},`,
    frTypo("Laisse-moi te partager une image. C'est celle qui ouvre le premier chapitre de mon livre."),
    frTypo("Imagine un homme assis dans une voiture puissante, moteur de course, carburant plein, route dégagée devant lui. Mais il conduit avec le frein à main à moitié serré, juste assez pour que la voiture avance quand même, lentement, difficilement, en brûlant deux fois plus d'énergie qu'il ne devrait. Il appuie plus fort sur l'accélérateur, la voiture résiste. Il appuie encore, elle résiste encore. Et lui, il se dit que la vie est dure, que la route est longue, que peut-être il n'est pas fait pour aller vite."),
    frTypo("Il n'a jamais pensé à regarder le frein à main."),
    frTypo("Cette image, c'est la vie de la plupart d'entre nous. Ni la puissance ni la volonté ne nous manquent. Mais on avance avec quelque chose de serré en nous, quelque chose qu'on ne voit pas, et qui consume chaque jour une force considérable."),
    view.key === 'aligne'
      ? frTypo("Ton test montre que ton frein à main est plutôt desserré en ce moment. Garde le réflexe de vérifier, surtout les jours de pression : c'est à ça que sert l'exercice que je t'ai envoyé.")
      : frTypo(`Ton test a montré où se trouve ton frein à main en ce moment : ${view.title.charAt(0).toLowerCase() + view.title.slice(1)}. As-tu fait l'exercice que je t'ai envoyé ? Si ce n'est pas encore fait, ce soir suffit. Quelques minutes, un carnet, et de l'honnêteté.`),
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
    view.key !== 'aligne' ? frTypo(view.further) : '',
    frTypo('Il coûte 5 000 F, en PDF, et tu le télécharges juste après le paiement (Wave, Orange Money, MTN ou carte) :') + ' ' + links.book,
    frTypo("Si ce n'est pas le moment, garde simplement ton exercice. Il t'appartient, et il fera son travail."),
    'Lamine Diabaté',
    frTypo('Pour ne plus recevoir mes e-mails :') + ' ' + links.stop,
  ].filter(Boolean);
  return { subject: frTypo(`${lead.prenom}, la suite de ton test`), text: body.join('\n\n') };
}

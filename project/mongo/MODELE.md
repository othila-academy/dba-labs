# Le modèle du catalogue

## Choix d'imbrication

L'écran d'une notice affiche son titre, ses auteurs, ses mots-clés, sa note moyenne et ses derniers avis : un document par notice contient tout cela, et se lit en une fois, sans jointure.

- **Les auteurs sont imbriqués**, en textes « Prénom Nom ». Ils ne changent presque jamais, et l'application les affiche toujours avec la notice. Le catalogue n'a pas de fiche d'auteur : il n'y a rien à référencer.
- **Les 5 avis les plus récents sont imbriqués** (motif « subset ») : c'est ce que l'écran montre. Une notice très commentée en a des dizaines, et bientôt des centaines. Les imbriquer tous ferait grossir le document sans limite (16 Mio au plus), et alourdirait chaque lecture.
- **Tous les avis restent à part**, dans `avis_bruts`, indexés par `{ notice_id: 1, date: -1 }`. La page « tous les avis » les lit là, page par page.
- **`note_moyenne` est calculée** à la construction, plutôt qu'à chaque lecture.

Le prix à payer : quand un avis arrive, il faut l'écrire dans `avis_bruts`, puis mettre à jour, dans le document, `avis_recents` (`$push` avec `$sort` et `$slice: 5`) et `note_moyenne`. C'est une écriture de plus, contre des milliers de lectures plus simples.

## Différences avec le modèle relationnel

En PostgreSQL, ce catalogue ferait cinq tables : `notice`, `auteur`, `notice_auteur`, `avis`, plus une table par type pour ce qui est propre aux DVD, aux jeux et aux revues. L'écran d'une notice demanderait quatre jointures, et le schéma imposerait la même forme à tous les types.

- **Hétérogénéité** : un document porte les champs de son type (`duree_min` d'un DVD, `joueurs` d'un jeu), sans colonnes vides ni tables annexes. Le validateur n'impose que le contrat commun, celui que l'application interroge.
- **Lecture** : un document répond à un écran, là où le relationnel demande une requête avec jointures.
- **Cohérence** : en relationnel, une clé étrangère garantit qu'un avis vise une notice qui existe, et chaque donnée n'est écrite qu'une fois. Ici, les avis récents sont en double : c'est à l'application (ou à la reconstruction par `001_catalogue.js`) de les tenir à jour, et aucune contrainte ne relie `avis_bruts.notice_id` au catalogue.
- **Transactions** : MongoDB en a, mais un modèle qui en demande souvent est un modèle relationnel déguisé. Ici, une notice et ses avis récents tiennent dans un document, mis à jour d'un seul coup.

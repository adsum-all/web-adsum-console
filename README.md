# Console éditeur ADSUM

L'outil de l'éditeur, pas celui de l'organisation cliente.

Le back-office appartient à l'organisation : il sert à gérer ses membres, ses
activités, son pointage. La console appartient à l'éditeur : elle sert à voir ce qui
se passe sur la plateforme, à répondre aux demandes de support et, à terme, à piloter
les organisations clientes et leurs licences.

Les confondre serait la faute. Un opérateur qui suit plusieurs organisations ne doit
jamais se retrouver à un clic du dossier d'un membre, et un administrateur d'une
organisation ne doit jamais voir les incidents d'une autre. C'est la raison de ce
dépôt séparé, de cette application séparée et de ce domaine séparé.

## Ce que la console peut faire

- **Support** : la file des demandes, la prise en charge, la réponse par courriel et
  la clôture. Une réponse qui n'est pas partie est signalée comme telle sur l'échange
  lui-même, parce qu'une demande sans réponse et une demande dont la réponse a échoué
  se ressemblent jusqu'à ce que quelqu'un enregistre la différence.

## Ce que la console ne peut pas faire

Accéder au dossier d'un membre. Ce n'est pas une consigne, c'est une propriété : le
client n'appelle que les points d'entrée de support et d'authentification, et
l'API de support ne sait renvoyer ni la santé, ni les documents, ni l'historique de
présence de qui que ce soit. Un fil porte un nom, une adresse et un message.

Consulter un dossier relève de `membres.consulter`, dans le back-office, où cet accès
est déjà encadré et journalisé.

## Développement

```
npm install
npm run dev
```

L'API visée est `https://adsum-api.vercel.app` par défaut, surchargeable par
`VITE_API_URL`.

## Déploiement

```
npm run build
npx wrangler pages deploy dist --project-name adsum-console --branch main
```

## Accès

La permission requise est `support.traiter`. Elle est portée par les rôles `admin` et
`super_admin`, et s'accorde depuis le back-office. Un compte sans cette permission se
connecte mais la console le lui dit franchement au lieu d'afficher des écrans vides.

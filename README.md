# showmaniac - Track your TV shows

The simpliest way to track your TV shows. Shows the previous and next air date of your added TV shows
in your local time. All on **1 page**, no need to click around.

PWA built with Vue 3, Vite, a little good old Bootstrap CSS, and JS. No backend, all data is stored in the browser's local storage. Firebase is used for authentication, and if you want to sync your data across devices, you need to sign in.

Deployed via Netlify

[![Netlify Status](https://api.netlify.com/api/v1/badges/733e4f7e-13ac-460a-89f1-c8088c8dd79a/deploy-status)](https://app.netlify.com/sites/showmaniac/deploys)

## Features

* Add your favorite TV shows
* Watch latest episode and mark it as seen
* See when the next episode will air
* Change last seen episode: Marking the latest episode as seen is one thing. The other thing is **catching up** to the latest one!

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Credits

* [TVmaze API](https://www.tvmaze.com/api) for the TV show data
* [Trakt API](https://trakt.docs.apiary.io/) for popular shows
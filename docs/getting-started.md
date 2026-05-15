# Getting Started

Install:

```bash
npm install -g arxgen
```

Create a TypeScript Express API:

```bash
arxgen create \
  --name student-api \
  --language typescript \
  --framework express \
  --entity student \
  --field name:string \
  --field email:string \
  --out ./generated
```

Run:

```bash
cd generated/student-api
npm install
npm run dev
```

Check available plugins:

```bash
arxgen list plugins
```

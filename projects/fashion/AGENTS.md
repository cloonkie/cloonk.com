# Fashion Tools

- Work only within the tool named in the request unless the change is explicitly suite-wide.
- Each tool owns its page, `src/`, `dist/`, `tsconfig.json`, and tool-specific assets.
- Treat each tool's `src/` TypeScript as the source of truth.
- Do not read or manually edit generated `dist/` files; regenerate them with the matching npm build command.
- Do not read full GeoJSON or generated data files unless the task explicitly requires their contents.
- Use `fashion.css`, `fashion-nav.js`, and `fashion-decisions.js` before adding tool-specific equivalents.
- Search for targeted symbols and read relevant ranges instead of loading whole large files.
- Run the named tool's `check:*` and `build:*` commands. Run the suite-wide commands only for shared changes.
- Keep generated JavaScript committed because the site deploys without a server-side build.

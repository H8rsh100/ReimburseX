# ReimburseX Frontend

Frontend application for ReimburseX, built with React and Vite.

## Stack

- React 18
- React Router v6
- Axios
- Vite

## Environment

Create `frontend/.env` with:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GEMINI_API_KEY=your_gemini_key_here
```

## Run Locally

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`

## Available Scripts

- `npm run dev` - start development server
- `npm run build` - create production build
- `npm run preview` - preview production build

## Notes

- API requests use `VITE_API_URL` from environment, falling back to `http://localhost:5000/api`.
- Authentication token is attached through Axios interceptors in `src/utils/api.js`.
- Admin dashboard includes WardenAI analysis powered by Gemini.

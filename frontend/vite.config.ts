{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable"],
    "lib": ["es2020", "dom.iterable"],
    "types": ["vite/client"]
  },
  "include": [
    "src/**/*",
    "src/**/*.tsx",
    "src/**/*.ts"
  ]
  },
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "proxy": {
    "/api": {
      "target": "http://localhost:3000",
      "changeOrigin": true
    }
  }
  },
  "build": {
    "outDir": "dist",
    "rollupOptions": {
      "output": {
        "manualChunks": {
          "vendor": ["react", "react-dom"],
          "ui": ["framer-motion", "lucide-react", "date-fns"],
          "charts": ["recharts"],
          "utils": ["zustand", "use-debounce", "axios"]
        }
      }
    }
  },
  "preview": {
    "port": 4173,
    "strictPort": false
  }
  }
}
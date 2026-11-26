import path from "node:path";

const vitestConfig = {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
};

export default vitestConfig;

import express from "express";
import cors from "cors";

import dotenv from "dotenv";
dotenv.config();
import Airouter from "./routes/AiRoute.js"
import { ErrorMiddleware } from "./middleware/error.middleware.js";


const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(ErrorMiddleware)



app.use("/api",Airouter)

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


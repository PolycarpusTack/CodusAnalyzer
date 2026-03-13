import express, { Request, Response } from "express";

const router = express.Router();

router.post("/execute", (req: Request, res: Response) => {
  const { expression } = req.body;

  try {
    // Dangerous: direct eval of user input
    const result = eval(expression);
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: "Invalid expression" });
  }
});

export default router;

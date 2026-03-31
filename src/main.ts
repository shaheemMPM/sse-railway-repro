import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { join } from "path";

const PORT = parseInt(process.env.PORT, 10) || 3000;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static HTML from /public
  app.useStaticAssets(join(__dirname, "..", "public"));

  app.enableCors();

  console.log(`Server running on http://0.0.0.0:${PORT}`);
  await app.listen(PORT, "0.0.0.0");
}

bootstrap();

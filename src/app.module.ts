import { Module } from "@nestjs/common";
import { SseController } from "./sse.controller";
import { PagesController } from "./pages.controller";

@Module({
  controllers: [PagesController, SseController],
})
export class AppModule {}

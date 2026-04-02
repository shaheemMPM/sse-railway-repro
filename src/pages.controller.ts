import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { join } from "path";

@Controller()
export class PagesController {
  private readonly publicDir = join(__dirname, "..", "public");

  @Get()
  index(@Res() res: Response) {
    res.sendFile(join(this.publicDir, "index.html"));
  }

  @Get("test-1")
  test1(@Res() res: Response) {
    res.sendFile(join(this.publicDir, "test-1.html"));
  }

  @Get("test-2")
  test2(@Res() res: Response) {
    res.sendFile(join(this.publicDir, "test-2.html"));
  }
}

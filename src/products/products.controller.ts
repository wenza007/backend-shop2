// src/products/products.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Res,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Response } from 'express';
import { PRODUCT_IMAGE } from './products.constants';
import { join } from 'path';
import { existsSync } from 'fs';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';

// src/products/products.controller.ts
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // =============================
  // CREATE
  // =============================
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard) 
  @Roles('admin') 
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() dto: CreateProductDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({
            maxSize: PRODUCT_IMAGE.MAX_SIZE,
          }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.productsService.create(dto, file);
  }

  // =============================
  // READ ALL
  // =============================
  @Get()
  findAll(
    @Query('keyword') keyword?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: string,
  ) {
    return this.productsService.findAll({
      keyword,
      minPrice,
      maxPrice,
      sort,
    });
  }

  // =============================
  // ✅ SERVE IMAGE
  // URL: /products/image/xxx.jpg
  // =============================
  @Get('image/:filename')
  getImage(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const imagePath = join(
      process.cwd(),
      'uploads',
      'products',
      filename,
    );

    if (!existsSync(imagePath)) {
      return res.status(404).send('Image not found');
    }

    return res.sendFile(imagePath);
  }

  // =============================
  // READ ONE (สำคัญ)
  // =============================
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // =============================
  // UPDATE
  // =============================
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({
            maxSize: PRODUCT_IMAGE.MAX_SIZE,
          }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.productsService.update(id, dto, file);
  }

  // =============================
  // DELETE
  // =============================
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}

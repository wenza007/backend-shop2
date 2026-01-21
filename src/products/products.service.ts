// src/products/products.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { safeUnlinkByRelativePath } from '../common/utils/file.utils';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private productModel: Model<Product>,
  ) { }

  private toPublicImagePath(filePath: string): string {
    return filePath
      .replace(/\\/g, '/')
      .replace(/^\.?\/?uploads\//, '');
  }

  // CREATE
  async create(dto: CreateProductDto, file?: Express.Multer.File) {
    const diskPath = file?.path?.replace(/\\/g, '/');
    const imageUrl = diskPath
      ? this.toPublicImagePath(diskPath)
      : undefined;

    try {
      return await this.productModel.create({
        ...dto,
        imageUrl : file ? file.filename : undefined,
      });
    } catch (err) {
      if (diskPath) await safeUnlinkByRelativePath(diskPath);
      throw new InternalServerErrorException('Create product failed');
    }
  }

  // READ ALL
  async findAll(query?: {
    keyword?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }): Promise<Product[]> {
    const filter: any = {};
    const sortOption: any = {};

    if (query?.keyword) {
      filter.name = { $regex: query.keyword, $options: 'i' };
    }

    if (query?.minPrice || query?.maxPrice) {
      filter.price = {};
      if (query.minPrice) filter.price.$gte = Number(query.minPrice);
      if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
    }

    if (query?.sort === 'price_desc') sortOption.price = -1;
    if (query?.sort === 'price_asc') sortOption.price = 1;

    return this.productModel.find(filter).sort(sortOption).exec();
  }

  // READ ONE
  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  // ✅ UPDATE + เปลี่ยนรูป
  // UPDATE
  async update(
    id: string,
    dto: UpdateProductDto,
    file?: Express.Multer.File,
  ): Promise<Product> {
    const product = await this.productModel.findById(id).exec();

    if (!product) {
      if (file?.path) {
        await safeUnlinkByRelativePath(file.path);
      }
      throw new NotFoundException('Product not found');
    }

    let newImageUrl = product.imageUrl;

    if (file) {
      newImageUrl = this.toPublicImagePath(file.path);
    }

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          imageUrl: file ? file.filename : undefined,
        },
        { new: true },
      )
      .exec();

    if (!updatedProduct) {
      // rollback รูปใหม่
      if (file?.path) {
        await safeUnlinkByRelativePath(file.path);
      }
      throw new NotFoundException('Product not found');
    }

    // ✅ update สำเร็จ → ค่อยลบรูปเก่า
    if (file && product.imageUrl) {
      await safeUnlinkByRelativePath(`uploads/${product.imageUrl}`);
    }

    return updatedProduct;
  }


  // DELETE
  async remove(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // 1️⃣ ลบไฟล์ก่อน
    if (product.imageUrl) {
      await safeUnlinkByRelativePath(`uploads/${product.imageUrl}`);
    }

    // 2️⃣ ลบข้อมูลใน DB
    await product.deleteOne();

    return product;
  }

}

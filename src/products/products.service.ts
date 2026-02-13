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
    private readonly productModel: Model<Product>,
  ) { }

  // =============================
  // CREATE
  // =============================
  async create(dto: CreateProductDto, file?: Express.Multer.File) {
    try {
      return await this.productModel.create({
        ...dto,
        imageUrl: file?.filename,
      });
    } catch (err) {
      // rollback ไฟล์ถ้าสร้างไม่สำเร็จ
      if (file?.path) {
        await safeUnlinkByRelativePath(file.path);
      }
      throw new InternalServerErrorException('Create product failed');
    }
  }

  // =============================
  // READ ALL
  // =============================
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

  // =============================
  // READ ONE
  // =============================
  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  // =============================
  // UPDATE (ถ้าเปลี่ยนรูป → ลบรูปเก่า)
  // =============================
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

    const oldImage = product.imageUrl;

    // อัปเดตข้อมูล
    Object.assign(product, dto);

    // ถ้ามีรูปใหม่
    if (file) {
      product.imageUrl = file.filename;
    }

    await product.save();

    // ลบรูปเก่า "หลังจาก save สำเร็จแล้ว"
    if (file && oldImage) {
      await safeUnlinkByRelativePath(`uploads/products/${oldImage}`);
    }

    return product;
  }

  // =============================
  // DELETE (ลบสินค้า + ลบรูป)
  // =============================
  async remove(id: string): Promise<{ message: string }> {
    const product = await this.productModel.findById(id).exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.imageUrl) {
      await safeUnlinkByRelativePath(
        `uploads/products/${product.imageUrl}`,
      );
    }

    await product.deleteOne();

    return { message: 'Product deleted successfully' };
  }
}

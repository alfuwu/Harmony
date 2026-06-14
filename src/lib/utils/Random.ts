export default class Random {
  private static readonly MASK64 = (1n << 64n) - 1n;
  private static readonly TWO64 = 1n << 64n;
  private static readonly DOUBLE_UNIT = 1.1102230246251565e-16; // 2^-53

  private static readonly _instance = new Random(BigInt(Date.now()));

  public static get instance(): Random {
    return Random._instance;
  }

  public static get Instance(): Random {
    return Random._instance;
  }

  private _seed: bigint;
  private _s0: bigint;
  private _s1: bigint;

  private constructor(seedOrS0?: bigint, s0?: bigint, s1?: bigint) {
    if (seedOrS0 === undefined) {
      let seed = BigInt(Date.now());
      const a = Random.splitmix(seed);
      seed = a.seed;
      const b = Random.splitmix(seed);
      this._seed = b.seed;
      this._s0 = a.value & Random.MASK64;
      this._s1 = b.value & Random.MASK64;
      return;
    }

    if (s0 === undefined || s1 === undefined) {
      let seed = seedOrS0 & Random.MASK64;
      const a = Random.splitmix(seed);
      seed = a.seed;
      const b = Random.splitmix(seed);
      this._seed = b.seed;
      this._s0 = a.value & Random.MASK64;
      this._s1 = b.value & Random.MASK64;
      return;
    }

    this._seed = seedOrS0 & Random.MASK64;
    this._s0 = s0 & Random.MASK64;
    this._s1 = s1 & Random.MASK64;
  }
  
  public reset(): void;
  public reset(seed: bigint): void;
  public reset(seed?: bigint): void {
    if (seed === undefined)
      seed = BigInt(Date.now());

    let working = seed & Random.MASK64;
    const a = Random.splitmix(working);
    working = a.seed;
    const b = Random.splitmix(working);
    this._seed = b.seed;
    this._s0 = a.value & Random.MASK64;
    this._s1 = b.value & Random.MASK64;
  }
  
  public resetWithState(s0: bigint, s1: bigint, seed: bigint): void {
    this._s0 = s0 & Random.MASK64;
    this._s1 = s1 & Random.MASK64;
    this._seed = seed & Random.MASK64;
  }

  public get seed(): bigint {
    return this._seed;
  }
  
  public getItems<T>(choices: readonly T[], destination: T[]): void;
  public getItems<T>(choices: readonly T[], length: number): T[];
  public getItems<T>(choices: readonly T[], destinationOrLength: T[] | number): void | T[] {
    if (choices == null)
      throw new TypeError("choices cannot be null or undefined.");
    if (choices.length === 0)
      throw new RangeError("Choices cannot be empty.");

    if (typeof destinationOrLength === "number") {
      const length = Math.trunc(destinationOrLength);
      if (length < 0)
        throw new RangeError("length must be non-negative.");

      const result = new Array<T>(length);
      for (let i = 0; i < length; i++)
        result[i] = this.choice(choices);

      return result;
    }

    const destination = destinationOrLength;
    for (let i = 0; i < destination.length; i++)
      destination[i] = this.choice(choices);
  }
  
  public choice<T>(choices: readonly T[]): T {
    if (choices == null)
      throw new TypeError("choices cannot be null or undefined.");
    if (choices.length === 0)
      throw new RangeError("Choices cannot be empty.");

    return choices[this.next(choices.length)];
  }

  public chance(chance: number): boolean {
    return this.sample() < chance;
  }

  public nextBytes(buffer: Uint8Array | number[]): void {
    if (buffer == null)
      throw new TypeError("buffer cannot be null or undefined.");

    if (buffer instanceof Uint8Array) {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      let i = 0;
      const len = buffer.byteLength;
      while (i + 8 <= len) {
        view.setBigUint64(i, this.internalSample(), true);
        i += 8;
      }
      if (i < len) {
        let rnd = this.internalSample();
        for (; i < len; i++, rnd >>= 8n)
          buffer[i] = Number(rnd & 0xffn);
      }
      return;
    }

    let i = 0;
    while (i + 8 <= buffer.length) {
      const rnd = this.internalSample();
      buffer[i++] = Number(rnd & 0xffn);
      buffer[i++] = Number((rnd >> 8n) & 0xffn);
      buffer[i++] = Number((rnd >> 16n) & 0xffn);
      buffer[i++] = Number((rnd >> 24n) & 0xffn);
      buffer[i++] = Number((rnd >> 32n) & 0xffn);
      buffer[i++] = Number((rnd >> 40n) & 0xffn);
      buffer[i++] = Number((rnd >> 48n) & 0xffn);
      buffer[i++] = Number((rnd >> 56n) & 0xffn);
    }
    if (i < buffer.length) {
      let rnd = this.internalSample();
      for (; i < buffer.length; i++, rnd >>= 8n)
        buffer[i] = Number(rnd & 0xffn);
    }
  }

  public nextByte(): number;
  public nextByte(maxValue: number): number;
  public nextByte(minValue: number, maxValue: number): number;
  public nextByte(minOrMax?: number, maybeMax?: number): number {
    if (minOrMax === undefined)
      return Number(this.internalSample() >> 56n) & 0xff;

    if (maybeMax === undefined) {
      const maxValue = Math.trunc(minOrMax);
      if (maxValue < 0)
        throw new RangeError("maxValue must be greater than or equal to 0");

      return maxValue === 0 ? 0 : Number(this.nextBelow(BigInt(maxValue)) & 0xffn);
    }

    const minValue = Math.trunc(minOrMax);
    const maxValue = Math.trunc(maybeMax);
    if (minValue > maxValue)
      throw new RangeError("minValue cannot be greater than maxValue");
    if (minValue === maxValue)
      return minValue;

    return minValue + Number(this.nextBelow(BigInt(maxValue - minValue)));
  }

  public next(): number;
  public next(maxValue: number): number;
  public next(minValue: number, maxValue: number): number;
  public next(minOrMax?: number, maybeMax?: number): number {
    if (minOrMax === undefined)
      return Number(this.internalSample() >> 33n);

    if (maybeMax === undefined) {
      const maxValue = Math.trunc(minOrMax);
      if (maxValue < 0)
        throw new RangeError("maxValue must be greater than or equal to 0");

      return maxValue === 0 ? 0 : Number(this.nextBelow(BigInt(maxValue)));
    }

    const minValue = Math.trunc(minOrMax);
    const maxValue = Math.trunc(maybeMax);
    if (minValue > maxValue)
      throw new RangeError("minValue cannot be greater than maxValue");
    if (minValue === maxValue)
      return minValue;

    return minValue + Number(this.nextBelow(BigInt(maxValue - minValue)));
  }

  public nextLong(): bigint;
  public nextLong(maxValue: bigint): bigint;
  public nextLong(minValue: bigint, maxValue: bigint): bigint;
  public nextLong(minOrMax?: bigint, maybeMax?: bigint): bigint {
    if (minOrMax === undefined)
      return this.internalSample() >> 1n;

    if (maybeMax === undefined) {
      if (minOrMax < 0n)
        throw new RangeError("maxValue must be greater than or equal to 0");
    
      return minOrMax === 0n ? 0n : this.nextBelow(minOrMax);
    }

    if (minOrMax > maybeMax)
      throw new RangeError("minValue cannot be greater than maxValue");
    if (minOrMax === maybeMax)
      return minOrMax;

    return minOrMax + this.nextBelow(maybeMax - minOrMax);
  }

  public nextFloat(): number;
  public nextFloat(maxValue: number): number;
  public nextFloat(minValue: number, maxValue: number): number;
  public nextFloat(minOrMax?: number, maybeMax?: number): number {
    if (minOrMax === undefined)
      return this.sample();
    if (maybeMax === undefined)
      return this.nextDouble(minOrMax);

    return this.nextDouble(minOrMax, maybeMax);
  }

  public nextDouble(): number;
  public nextDouble(maxValue: number): number;
  public nextDouble(minValue: number, maxValue: number): number;
  public nextDouble(minOrMax?: number, maybeMax?: number): number {
    if (minOrMax === undefined)
      return this.sample();

    if (maybeMax === undefined) {
      const maxValue = minOrMax;
      if (maxValue < 0.0)
        throw new RangeError("maxValue must be non-negative.");

      return this.sample() * maxValue;
    }

    if (minOrMax > maybeMax)
      throw new RangeError("minValue must be less than or equal to maxValue.");

    return minOrMax + this.sample() * (maybeMax - minOrMax);
  }
  
  public shuffle<T>(values: T[]): void {
    if (values == null)
      throw new TypeError("values cannot be null or undefined.");

    for (let i = values.length - 1; i > 0; i--) {
      const j = this.next(i + 1);
      Random.swap(values, i, j);
    }
  }
  
  protected sample(): number {
    return Number(this.internalSample() >> 11n) * Random.DOUBLE_UNIT;
  }

  public static rotl(x: bigint, k: number): bigint {
    const kk = BigInt(k & 63);
    return ((x << kk) | (x >> (64n - kk))) & Random.MASK64;
  }

  public internalSample(): bigint {
    const first = this._s0;
    const second = this._s1;
    const result = (first + second) & Random.MASK64;

    const x = first ^ second;

    this._s0 = ((((first << 55n) | (first >> 9n)) ^ x ^ (x << 14n)) & Random.MASK64);
    this._s1 = (((x << 36n) | (x >> 28n)) & Random.MASK64);

    return result;
  }

  public internalSamplePCG(): bigint {
    const old0 = this._s0;
    const old1 = this._s1;
    const mul0 = 0x2360ed051fc65da4n;
    const mul1 = 0x4385df649fccf645n;
    const incBase = ((this._seed << 1n) | 1n) & Random.MASK64;
    this._s0 = (old0 * mul0 + incBase) & Random.MASK64;
    this._s1 = (old1 * mul1 + (incBase ^ 0x5851f42d4c957f2dn)) & Random.MASK64;

    const xorshifted = (((old0 ^ old1) >> 18n) ^ old0) & Random.MASK64;
    const rot = Number(old1 >> 59n) & 63;
    return ((xorshifted >> BigInt(rot)) | (xorshifted << BigInt((64 - rot) & 63))) & Random.MASK64;
  }

  public nextBelow(bound: bigint): bigint {
    if (bound === 0n)
      return 0n;

    if ((bound & (bound - 1n)) === 0n)
      return this.internalSample() & (bound - 1n);

    const threshold = Random.TWO64 % bound;
    while (true) {
      const r = this.internalSample();
      if (r >= threshold)
        return r % bound;
    }
  }

  public static splitmix(seed: bigint): { value: bigint; seed: bigint } {
    let z = (seed + 0x9e3779b97f4a7c15n) & Random.MASK64;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & Random.MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & Random.MASK64;
    return {
      value: (z ^ (z >> 31n)) & Random.MASK64,
      seed: (seed + 0x9e3779b97f4a7c15n) & Random.MASK64,
    };
  }

  private static swap<T>(values: T[], i: number, j: number): void {
    const tmp = values[i];
    values[i] = values[j];
    values[j] = tmp;
  }

  public static create(seed?: bigint): Random {
    return seed === undefined ? new Random() : new Random(seed);
  }
}

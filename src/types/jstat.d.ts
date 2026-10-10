declare module "jstat" {
  const jStat: {
    beta: {
      inv: (p: number, alpha: number, beta: number) => number;
      sample: (alpha: number, beta: number) => number;
    };
  };
  export default jStat;
}

export const AsyncHandler = (fun) => {
  return async (req, res, next) => {
    Promise.resolve(fun(req, res, next)).catch(next);
  };
};

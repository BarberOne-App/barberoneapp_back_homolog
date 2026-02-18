// import "express";

// declare global {
//   namespace Express {
//     interface User {
//       id: string;
//       role: "admin" | "barber" | "client";
//       isAdmin: boolean;
//       name: string;
//       email: string | null;
//     }

//     interface Request {
//       user?: User;
//     }
//   }
// }

// export {};


import "express";

declare global {
  namespace Express {
    interface User {
      id: string; // uuid
      barbershopId: string; // uuid
      role: "admin" | "barber" | "client";
      isAdmin: boolean;
      name: string;
      email: string;
    }
    interface Request {
      user?: User;
    }
  }
}

export {};

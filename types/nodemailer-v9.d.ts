/**
 * The runtime is an npm alias for Nodemailer 9. Re-exporting the maintained
 * DefinitelyTyped contract keeps the alias typed without installing the
 * vulnerable Nodemailer package name solely for declarations.
 */
declare module "nodemailer-v9" {
  import nodemailer from "nodemailer"

  export default nodemailer
}

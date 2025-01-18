export class Apiresponse {
  constructor(statusCode, message, data = null,success) {
 
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.success=statusCode<400
  }
}



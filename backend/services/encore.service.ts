import { secret } from "encore.dev/config";
import { Service } from "encore.dev/service";
export const API_URL=secret("GPT_URL")
export const API_KEY=secret("GPT_API_KEY")


export default new Service("sip-stream")
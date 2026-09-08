import { quoteClassDiscount } from '../functions/_shared/discounts.ts';
Deno.test('discount underscore is literal and class/gym boundaries are exact',async()=>{
 const rows=[{id:'one',program_id:'gym',class_id:'class',code:'SAVEX20',is_active:true,discount_type:'percent',discount_value:20},{id:'two',program_id:'gym',class_id:'class',code:'SAVE_20',is_active:true,discount_type:'percent',discount_value:10}];
 const client={from:()=>{const filters:Record<string,unknown>={};const q={select:()=>q,eq:(key:string,value:unknown)=>{filters[key]=value;return q;},maybeSingle:async()=>({data:rows.find(r=>Object.entries(filters).every(([k,v])=>(r as any)[k]===v))||null,error:null})};return q;}};
 const quote=await quoteClassDiscount(client,{programId:'gym',classId:'class',code:' save_20 ',listAmountCents:10000});if(quote.code_id!=='two'||quote.final_amount_cents!==9000)throw new Error('Literal code must determine price');
 for(const args of [{programId:'other',classId:'class'},{programId:'gym',classId:'other'}]){
 let rejected=false;try{await quoteClassDiscount(client,{...args,code:'SAVE_20',listAmountCents:10000});}catch{rejected=true;}if(!rejected)throw new Error('Discount escaped scope');
 }
});

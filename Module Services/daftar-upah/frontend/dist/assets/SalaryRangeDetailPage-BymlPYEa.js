import{u as W,g as J,j as e,L as K,v as F,l as b,b as i}from"./index-B0X8HyZi.js";import{r as n}from"./vendor-react-Bsd05r8m.js";import{M as O}from"./MonthSelector-ImXKhCPk.js";import{R as U}from"./ReportPrintMetadata-Bs-m1b3j.js";import{f as H}from"./payrollService-BXjp9pbp.js";import{R as q,c as Q}from"./payrollReportFilters-QNhTIBet.js";import{u as V,P as X,a as w}from"./usePresentMode-C-YbdiWV.js";/* empty css                                   *//* empty css                                */import"./vendor-utils-xjWZuiPI.js";import"./vendor-excel-xB9G-j4o.js";const Y=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],ce=({onBack:A,initialMonth:m=new Date().getMonth()+1,initialYear:h=new Date().getFullYear(),initialMinSalary:x=6e6,initialMaxSalary:g=null})=>{const{token:j}=W(),I=J(),[c,N]=n.useState(m),[p,k]=n.useState(h),[o,S]=n.useState(x),[l,v]=n.useState(g);n.useEffect(()=>{m!==void 0&&N(m),h!==void 0&&k(h),x!==void 0&&S(x),g!==void 0&&v(g)},[m,h,x,g]);const[$,L]=n.useState([]),[s,E]=n.useState(null),[R,f]=n.useState(!0),[_,y]=n.useState(""),{presenting:D,activeIndex:G,enter:B,exit:M}=V(),C=n.useCallback(async()=>{var a,d,u;if(!j){f(!1),y("Token autentikasi tidak tersedia");return}f(!0),y("");try{const r=await H(j,{month:c,year:p,skip:0,limit:q,summary_only:"true"},!0);if(Array.isArray(r))throw new Error("Gagal mengambil data payroll report");const P=Q((r==null?void 0:r.data)||[],{minSalary:o,maxSalary:l});L(P.data),E({...(r==null?void 0:r.meta)||{},...P.meta,source_count:((a=r==null?void 0:r.data)==null?void 0:a.length)||0})}catch(r){console.error(r),y(((u=(d=r.response)==null?void 0:d.data)==null?void 0:u.error)||r.message||"Gagal mengambil data")}finally{f(!1)}},[j,c,p,o,l]);n.useEffect(()=>{C()},[C]);const t=a=>!a||a===0?"-":new Intl.NumberFormat("id-ID").format(a);if(R)return e.jsx(K,{isLoading:R,message:"Memuat data..."});const z=`${Y[c-1]} ${p}`,T=l?`Rp ${t(o)} - Rp ${t(l)}`:`Gaji > Rp ${t(o)}`;return e.jsxs("div",{className:"wsp-container salary-range-container",children:[e.jsxs("div",{className:"wsp-action-bar no-print",children:[e.jsxs("div",{className:"left-section",style:{display:"flex",gap:"1rem",alignItems:"center"},children:[e.jsx("button",{onClick:A,className:"wsp-btn",children:"KEMBALI"}),e.jsx("button",{onClick:()=>I(`/cost-per-ton-story?month=${c}&year=${p}`),className:"wsp-btn",style:{background:"#1F6F43",color:"#fff",border:"none",fontWeight:700},children:"Cost/Ton Story →"}),e.jsxs("div",{className:"wsp-filter-group",style:{display:"flex",gap:"0.5rem",alignItems:"center"},children:[e.jsx(O,{month:c,year:p,onChange:(a,d)=>{N(a),k(d)}}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px"},children:[e.jsx("span",{style:{fontSize:"0.85rem",fontWeight:"600"},children:"Gaji >"}),e.jsx("input",{type:"number",value:o,onChange:a=>S(parseInt(a.target.value)||0),className:"wsp-select",style:{width:"150px",padding:"0.5rem",border:"1px solid #cbd5e1",borderRadius:"6px"}})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px"},children:[e.jsx("span",{style:{fontSize:"0.85rem",fontWeight:"600"},children:"-"}),e.jsx("input",{type:"number",value:l||"",onChange:a=>v(a.target.value?parseInt(a.target.value):null),placeholder:"Maksimal (opsional)",className:"wsp-select",style:{width:"180px",padding:"0.5rem",border:"1px solid #cbd5e1",borderRadius:"6px"}})]})]})]}),e.jsx("div",{className:"right-section",children:e.jsx("button",{onClick:()=>F({orientation:"landscape"}),className:"wsp-btn",children:"PRINT"})})]}),_&&e.jsx("div",{style:{padding:"1rem",backgroundColor:"#fee2e2",color:"#b91c1c",borderRadius:"0.5rem",marginBottom:"1rem"},children:_}),e.jsx("div",{className:"no-print",style:{display:"flex",justifyContent:"flex-end",marginBottom:"0.75rem"},children:e.jsx(X,{presenting:D,activeIndex:G,slideCount:3,onEnter:B,onExit:M,caption:`Detail Gaji Range · ${z} · ${T}`})}),e.jsx(w,{num:"01",id:"slide-01",title:"Ringkasan Range Gaji",subtitle:"Parameter range dan total agregat periode berjalan",children:e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(210px, 1fr))",gap:20},children:[e.jsx(b,{label:"Total Karyawan",value:s?t(s.count):"-",note:`Range ${T}`,color:i.upah}),e.jsx(b,{label:"Total Upah Bersih",value:s?`Rp ${t(s.sum_upah_bersih)}`:"-",note:"Akumulasi karyawan dalam range",color:i.premi}),e.jsx(b,{label:"Total Lembur",value:s?`Rp ${t(s.sum_lembur)}`:"-",note:"Pendapatan lembur dalam range",color:i.lembur}),e.jsx(b,{label:"Total Potongan",value:s?`Rp ${t(s.sum_potongan)}`:"-",note:"Potongan bersih dalam range",color:i.potongan})]})}),e.jsx(w,{num:"02",id:"slide-02",title:"Daftar Karyawan dalam Range",subtitle:"Rincian gaji, tunjangan, potongan, dan upah bersih per karyawan",children:e.jsxs("div",{id:"salary-range-report",className:"wsp-paper a4-landscape",children:[e.jsxs("div",{className:"wsp-header",children:[e.jsx("h1",{className:"wsp-company-name",children:"PT. REBINMAS JAYA"}),e.jsx("h2",{className:"wsp-report-title",children:"LAPORAN DETAIL GAJI RANGE"}),e.jsxs("div",{className:"wsp-subtitle",children:["Periode: ",z," | Gaji Bersih > Rp ",t(o),l&&` - Rp ${t(l)}`]}),e.jsx(U,{mode:"Salary Range Detail",source:"Payroll Report API",scope:"Karyawan",items:[{label:"Min",value:`Rp ${t(o)}`},{label:"Max",value:l?`Rp ${t(l)}`:""}],note:"Daftar menampilkan karyawan dalam range upah bersih yang dipilih."}),s&&e.jsxs("div",{className:"wsp-meta",style:{fontSize:"0.8rem",color:"#666"},children:["Total Karyawan: ",s.count," | Total Upah Bersih: Rp ",t(s.sum_upah_bersih)]})]}),e.jsx("div",{className:"wsp-table-wrapper",children:e.jsxs("table",{className:"wsp-table salary-range-table",children:[e.jsxs("thead",{children:[e.jsxs("tr",{className:"wsp-header-master",children:[e.jsx("th",{rowSpan:2,style:{width:"40px"},children:"#"}),e.jsx("th",{rowSpan:2,style:{width:"180px"},children:"Karyawan"}),e.jsx("th",{rowSpan:2,style:{width:"120px"},children:"Jabatan"}),e.jsx("th",{rowSpan:2,className:"text-right",style:{width:"120px"},children:"Gaji Aktual"}),e.jsx("th",{colSpan:4,className:"text-center",children:"Tunjangan"}),e.jsx("th",{rowSpan:2,className:"text-right",style:{width:"100px"},children:"Total Pot"}),e.jsx("th",{rowSpan:2,className:"text-right",style:{width:"120px"},children:"Upah Bersih"})]}),e.jsxs("tr",{className:"wsp-header-sub",children:[e.jsx("th",{className:"text-right",style:{fontSize:"11px",width:"80px"},children:"Jabatan"}),e.jsx("th",{className:"text-right",style:{fontSize:"11px",width:"80px"},children:"Beras"}),e.jsx("th",{className:"text-right",style:{fontSize:"11px",width:"80px"},children:"Masa Kerja"}),e.jsx("th",{className:"text-right",style:{fontSize:"11px",width:"90px",backgroundColor:"#fee2e2"},children:"Lembur"})]})]}),e.jsx("tbody",{children:$.map((a,d)=>{const u=a.lembur_jumlah>0;return e.jsxs("tr",{className:d%2===0?"wsp-row-even":"wsp-row-odd",children:[e.jsx("td",{className:"text-center",children:a.rank}),e.jsxs("td",{children:[e.jsx("div",{style:{fontWeight:"600",fontSize:"13px"},children:a.nama}),e.jsx("div",{style:{fontSize:"11px",color:"#666"},children:a.empcode||a.nik})]}),e.jsx("td",{style:{fontSize:"12px"},children:a.jabatan_estate||"-"}),e.jsx("td",{className:"text-right",children:t(a.gaji_pokok_aktual)}),e.jsx("td",{className:"text-right",style:{fontSize:"11px"},children:t(a.jabatan_jumlah)}),e.jsx("td",{className:"text-right",style:{fontSize:"11px"},children:t(a.beras_jumlah)}),e.jsx("td",{className:"text-right",style:{fontSize:"11px"},children:t(a.masa_kerja_jumlah)}),e.jsx("td",{className:"text-right",children:u?e.jsx("span",{className:"lembur-highlight",children:t(a.lembur_jumlah)}):e.jsx("span",{style:{color:"#999"},children:"-"})}),e.jsx("td",{className:"text-right",style:{fontSize:"11px"},children:t(a.total_potongan_bersih)}),e.jsx("td",{className:"text-right",style:{fontWeight:"bold",fontSize:"13px"},children:t(a.upah_bersih)})]},d)})}),s&&e.jsx("tfoot",{className:"wsp-footer",children:e.jsxs("tr",{style:{backgroundColor:"#f3f4f6",fontWeight:"bold"},children:[e.jsx("td",{colSpan:3,className:"text-right",children:"GRAND TOTAL:"}),e.jsx("td",{className:"text-right",children:t(s.sum_gaji_pokok)}),e.jsx("td",{className:"text-right",children:"-"}),e.jsx("td",{className:"text-right",children:"-"}),e.jsx("td",{className:"text-right",children:"-"}),e.jsx("td",{className:"text-right",children:e.jsx("span",{className:s.sum_lembur>0?"lembur-highlight":"",children:t(s.sum_lembur)})}),e.jsx("td",{className:"text-right",children:t(s.sum_potongan)}),e.jsx("td",{className:"text-right",style:{fontSize:"14px"},children:t(s.sum_upah_bersih)})]})})]})})]})}),e.jsx(w,{num:"03",id:"slide-03",title:"Catatan Pembacaan",subtitle:"Cara membaca tabel dan tindak lanjut analisis",children:e.jsxs("div",{style:{background:i.surface,border:`1px solid ${i.border}`,borderRadius:10,padding:24},children:[e.jsx("div",{style:{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:i.muted,marginBottom:12},children:"Cara Membaca"}),e.jsxs("ul",{style:{margin:0,paddingLeft:18,color:i.text2,fontSize:"0.9rem",lineHeight:1.7},children:[e.jsx("li",{children:"Baris menampilkan karyawan dengan upah bersih di dalam range yang dipilih pada filter periode berjalan."}),e.jsx("li",{children:"Sorotan pada kolom Lembur menandai karyawan dengan pendapatan lembur di atas nol."}),e.jsx("li",{children:"Total Potongan merangkum seluruh potongan bersih per karyawan pada periode ini."}),e.jsx("li",{children:"Gunakan tombol Cost/Ton Story untuk melihat konteks biaya per ton pada periode yang sama."})]})]})}),e.jsx("style",{children:`
                .salary-range-container {
                    --paper-width: 297mm;
                    --paper-height: 210mm;
                }

                .salary-range-table {
                    font-size: 12px;
                    border-collapse: collapse;
                    width: 100%;
                }

                .salary-range-table th,
                .salary-range-table td {
                    padding: 6px 8px;
                    border: 1px solid #e5e7eb;
                }

                .wsp-row-even {
                    background-color: #f9fafb;
                }

                .wsp-row-odd {
                    background-color: #ffffff;
                }

                .wsp-row-even:hover,
                .wsp-row-odd:hover {
                    background-color: #e0f2fe !important;
                }

                .lembur-highlight {
                    background: #fee2e2;
                    color: #991b1b;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 4px;
                    display: inline-block;
                    font-size: 11px;
                }

                .text-center {
                    text-align: center;
                }

                .text-right {
                    text-align: right;
                }

                /* Print optimization */
                @media print {
                    .no-print {
                        display: none !important;
                    }

                    .a4-landscape {
                        width: 297mm;
                        height: 210mm;
                        margin: 0;
                        padding: 10mm;
                        page-break-after: always;
                    }

                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                }
            `})]})};export{ce as default};

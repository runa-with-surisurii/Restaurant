import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";


export const Route = createFileRoute("/admin/login")({

  head: () => ({
    meta: [
      {
        title:"Admin Login — Ember & Oak"
      }
    ]
  }),

  component: AdminLogin

});



function AdminLogin(){

const navigate = useNavigate();



useEffect(()=>{


const user = localStorage.getItem(
"ember_user"
);



if(user){

const data = JSON.parse(user);



if(data.role==="admin"){

navigate({
to:"/admin",
replace:true
});

}

else{

navigate({
to:"/login",
replace:true
});

}


}

else{


navigate({
to:"/login",
replace:true
});


}



},[navigate]);



return (

<div className="
grid
min-h-screen
place-items-center
">

Checking authentication...

</div>

);


}
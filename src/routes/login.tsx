import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import {
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  Flame,
  Loader2,
} from "lucide-react";

import {
  toast,
} from "sonner";


import {
  Button,
} from "@/components/ui/button";


import {
  Input,
} from "@/components/ui/input";


import {
  useStore,
} from "@/lib/store";


import {
  defaultRouteForRole,
} from "@/lib/auth";





export const Route = createFileRoute("/login")({

  head:()=>({

    meta:[

      {
        title:"Login — Ember & Oak",
      },

    ],

  }),


  component:LoginPage,

});







function LoginPage(){


const navigate = useNavigate();


const {
  authenticate
}=useStore();





const [identifier,setIdentifier]
=
useState("");



const [password,setPassword]
=
useState("");



const [showPassword,setShowPassword]
=
useState(false);



const [loading,setLoading]
=
useState(false);



const [error,setError]
=
useState("");









const onSubmit = async(
e:React.FormEvent
)=>{


e.preventDefault();



setError("");





if(
!identifier.trim()
||
!password
){


setError(
"Please enter username and password."
);


return;

}






try{


setLoading(true);





const role = await authenticate(

identifier,

password

);






toast.success(
"Login successful"
);







navigate({

to:
defaultRouteForRole(role),

replace:true

});





}

catch(err){



setError(

err instanceof Error

?

err.message

:

"Login failed"

);



}



finally{


setLoading(false);


}



};











return (

<div className="
grid
min-h-screen
bg-muted/30
px-4
py-10
">


<div className="
m-auto
w-full
max-w-md
rounded-[2rem]
border
bg-card
p-8
shadow-elegant
">





<div className="
mx-auto
grid
size-14
place-items-center
rounded-2xl
bg-gradient-ember
">


<Flame
className="
size-7
text-white
"
/>


</div>







<h1 className="
mt-5
text-center
font-display
text-5xl
">

Login

</h1>





<p className="
mt-3
text-center
text-sm
text-muted-foreground
">

Admin / Branch / Customer

</p>








<form

onSubmit={onSubmit}

className="
mt-8
space-y-4
"

>







<Input

placeholder="Username"

value={identifier}

onChange={(e)=>
setIdentifier(e.target.value)
}

/>








<div className="
relative
">


<Input

type={
showPassword
?
"text"
:
"password"
}

placeholder="Password"

value={password}

onChange={(e)=>
setPassword(e.target.value)
}

/>






<button

type="button"

onClick={()=>setShowPassword(
v=>!v
)}

className="
absolute
right-3
top-3
"

>


{

showPassword

?

<EyeOff size={18}/>

:

<Eye size={18}/>


}


</button>



</div>









{
error &&


<div className="
rounded-lg
bg-red-100
p-3
text-sm
text-red-600
">

{error}

</div>


}









<Button

disabled={loading}

className="
h-12
w-full
rounded-full
"

>


{

loading

?

<Loader2
className="animate-spin"
/>

:

"Login"

}



</Button>





</form>









<div className="
mt-6
rounded-xl
bg-muted
p-4
text-xs
">


<p>
Admin:
<b>
admin / mainadmin
</b>
</p>


<p>
Branch:
<b>
branch1 / b1
</b>
</p>


</div>









<div className="
mt-5
text-center
text-sm
">


Customer?


<Link

to="/register"

className="
ml-1
font-semibold
text-primary
"

>

Create Account

</Link>



</div>





</div>


</div>


);


}
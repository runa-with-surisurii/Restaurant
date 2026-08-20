import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Flame,
  ShoppingBag,
  Heart,
  User,
  Menu as MenuIcon,
  X,
  Building2,
  LogOut,
  Shield,
} from "lucide-react";

import { useState } from "react";

import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";



const customerNav = [
  {to:"/",label:"Home"},
  {to:"/menu",label:"Menu"},
  {to:"/cart",label:"Cart"},
  {to:"/orders",label:"Orders"},
  {to:"/profile",label:"Profile"},
] as const;



const staffNav = [
  {
    to:"/admin",
    label:"Admin Console",
    roles:["main_admin"]
  },

  {
    to:"/branch-manager",
    label:"Branch Manager",
    roles:["main_admin","branch_manager"]
  }

] as const;






export function SiteHeader(){


const {
  cartCount,
  user,
  adminUser,
  logoutAll

}=useStore();



const navigate = useNavigate();



const pathname =
useRouterState({
select:(s)=>s.location.pathname
});



const [open,setOpen]=useState(false);





const isStaff =
Boolean(adminUser);



const nav =
isStaff
?
[]
:
customerNav;



const visibleStaffNav =
staffNav.filter((s)=>
adminUser
?
s.roles.includes(
adminUser.role as any
)
:
false
);





const staffHome =
adminUser?.role==="main_admin"
?
"/admin"
:
"/branch-manager";





return (

<header className="
sticky
top-0
z-40
border-b
bg-background/90
backdrop-blur
">


<div className="
mx-auto
flex
max-w-7xl
items-center
justify-between
gap-4
px-4
py-3
md:px-6
">





<Link
to="/"
className="
flex
items-center
gap-2
"
>


<span className="
grid
size-9
place-items-center
rounded-lg
bg-gradient-ember
">

<Flame
className="
size-5
text-white
"
/>

</span>


<span className="
font-display
text-2xl
">

Ember & Oak

</span>


</Link>






<nav className="
hidden
md:flex
gap-2
">


{
nav.map((n)=>(


<Link

key={n.to}

to={n.to}

className={cn(

"rounded-md px-3 py-2 text-sm",

pathname===n.to
?
"text-primary"
:
"text-muted-foreground"

)}

>

{n.label}

</Link>


))

}



</nav>









<div className="
flex
items-center
gap-2
">





{/* BRANCH INFO */}

{
adminUser && (

<div className="
hidden
md:flex
rounded-xl
border
px-4
py-2
">


<div>


<p className="
text-sm
font-semibold
">

{
adminUser.branchName
||
(
adminUser.branchId
?
`Branch ${adminUser.branchId}`
:
"Main Office"
)
}

</p>



<p className="
text-xs
text-muted-foreground
">

{
adminUser.role==="branch_manager"
?
"Branch Manager"
:
"Main Admin"
}

</p>


</div>


</div>

)

}







{
!adminUser && (

<>


<Button

asChild

variant="ghost"

size="icon"

>

<Link to="/favorites">

<Heart/>

</Link>

</Button>





<Button

asChild

variant="ghost"

size="icon"

className="relative"

>

<Link to="/cart">

<ShoppingBag/>


{
cartCount>0 &&

<span className="
absolute
-right-1
-top-1
rounded-full
bg-primary
px-1
text-xs
">

{cartCount}

</span>

}


</Link>

</Button>


</>

)

}









{/* STAFF MENU */}

{
adminUser && (

<DropdownMenu>


<DropdownMenuTrigger asChild>


<Button

variant="ghost"

size="icon"

>

<Shield/>

</Button>


</DropdownMenuTrigger>





<DropdownMenuContent
align="end"
>


<DropdownMenuLabel>


<p className="font-semibold">

{
adminUser.name
}

</p>


<p className="
text-xs
text-muted-foreground
">

{
adminUser.role
}

</p>


</DropdownMenuLabel>



<DropdownMenuSeparator/>





{
visibleStaffNav.map((s)=>(


<DropdownMenuItem

key={s.to}

onSelect={()=>navigate({to:s.to as any})}

>


{
s.to==="/admin"
?
<Building2/>
:
<Shield/>
}


{s.label}


</DropdownMenuItem>


))

}





<DropdownMenuSeparator/>




<DropdownMenuItem


className="
text-destructive
"


onSelect={()=>{

logoutAll();

navigate({
to:"/login"
});

}}


>


<LogOut/>

Logout


</DropdownMenuItem>




</DropdownMenuContent>


</DropdownMenu>

)

}









{/* CUSTOMER PROFILE */}

{
user && !adminUser && (


<DropdownMenu>


<DropdownMenuTrigger asChild>


<Button
variant="ghost"
size="icon"
>

<User/>

</Button>


</DropdownMenuTrigger>





<DropdownMenuContent>


<DropdownMenuLabel>

{user.name}

</DropdownMenuLabel>



<DropdownMenuSeparator/>


<DropdownMenuItem
onSelect={()=>
navigate({
to:"/profile"
})
}
>

Profile

</DropdownMenuItem>




<DropdownMenuItem

className="text-destructive"

onSelect={()=>{

logoutAll();

navigate({
to:"/login"
});

}}

>

Logout

</DropdownMenuItem>



</DropdownMenuContent>


</DropdownMenu>


)

}









{
!user && !adminUser && (

<Button

asChild

className="
rounded-full
"

>


<Link to="/login">

Sign in

</Link>


</Button>

)

}






<Button

variant="ghost"

size="icon"

className="
md:hidden
"

onClick={()=>
setOpen(!open)
}

>


{
open
?
<X/>
:
<MenuIcon/>
}


</Button>






</div>



</div>


</header>


);


}
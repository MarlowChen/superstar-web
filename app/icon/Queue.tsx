import React from "react";

interface IconProps {
  wrapperClassName?: string;
}

export const InQueue = ({ wrapperClassName = "" }: IconProps) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg
        width="2404"
        height="70"
        viewBox="0 0 2404 70"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
      >
        <rect
          x="727"
          y="140"
          width="105"
          height="71"
          fill="url(#pattern0_2001_5114)"
        />
        <rect
          x="1744"
          y="120"
          width="102"
          height="95"
          fill="url(#pattern1_2001_5114)"
        />
        <rect
          x="1450"
          y="28"
          width="93"
          height="62"
          fill="url(#pattern2_2001_5114)"
        />
        <rect x="1328" width="97" height="68" fill="url(#pattern3_2001_5114)" />
        <rect
          y="201"
          width="2404"
          height="28"
          fill="url(#pattern4_2001_5114)"
        />
        <rect
          x="103"
          y="109"
          width="97"
          height="101"
          fill="url(#pattern5_2001_5114)"
        />
        <defs>
          <pattern
            id="pattern0_2001_5114"
            patternContentUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <use
              xlinkHref="#image0_2001_5114"
              transform="scale(0.00952381 0.0140845)"
            />
          </pattern>
          <pattern
            id="pattern1_2001_5114"
            patternContentUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <use
              xlinkHref="#image1_2001_5114"
              transform="scale(0.00980392 0.0105263)"
            />
          </pattern>
          <pattern
            id="pattern2_2001_5114"
            patternContentUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <use
              xlinkHref="#image2_2001_5114"
              transform="scale(0.0107527 0.016129)"
            />
          </pattern>
          <pattern
            id="pattern3_2001_5114"
            patternContentUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <use
              xlinkHref="#image3_2001_5114"
              transform="scale(0.0103093 0.0147059)"
            />
          </pattern>
          <pattern
            id="pattern4_2001_5114"
            patternContentUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <use
              xlinkHref="#image4_2001_5114"
              transform="scale(0.000415973 0.0357143)"
            />
          </pattern>
          <pattern
            id="pattern5_2001_5114"
            patternContentUnits="objectBoundingBox"
            width="1"
            height="1"
          >
            <use
              xlinkHref="#image5_2001_5114"
              transform="scale(0.0103093 0.00990099)"
            />
          </pattern>
          <image
            id="image0_2001_5114"
            width="105"
            height="71"
            preserveAspectRatio="none"
            xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGkAAABHCAYAAAAEJGl8AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAaaADAAQAAAABAAAARwAAAAC7ZCiHAAADMUlEQVR4Ae2dy27CMBRE24oN/8eSz2PJ/7FsG6RTiavYiW1sD2XYuH7ljuf61AlK1Y8Pf+yAHWh34LPmErfb7Xtt3vF4rLre2rX2tKno+P79rOn9/P2stZe2fZVO8PjxDhxKQrJzz+fz6jT6exNFnNk6IOh0Oq36QX8rUSZp1V6txl2/M7d2blzS5XK5Nz2bKBUdEJIiKPpxvV7vTbVEmaToqGBdMkkLMVAz07OFmOUzU8MSWzJJs01Ri190d9cqHjpSZxX93LVRT41v1ZOaDz2cOdRrz5StOFvXNUkpB4Xah5AEESlCYj/+xPG09yohBoKIQ51+2mtLrhOvmyLKJNU6PXBeV5JUCBnoZzZUJIjBW0SZJJwSLt8ySQvhUC6cmz9pb5mkv9W/yA8PZxK7a/RzySivWF+8a1Rfr0katUMa4txJetUdtnfdcX3Mi0TRrlaaJLWMrOg5LLuMHUU/dXYg7S7nOGCS5vheFNVJKrJrzmAnaY7vRVGdpCK75gx2kub4XhTVSSqya85gJ2mO70VRH767K5rpwd0d4DnVJHW3uj2Ak9TuYfcrOEndLW4P0OVM4ru/dnlaV+BdhNGqTNJoxyvidSFpS0f8qwvuYrbmjernryBmkRPXaZKiI4L1oSRFgtT8iG+Qpt6TK9XdSqRJKnV8wvguJEFMXI/6WzlRL2RBVOxvJYTrcQYSj3ZKk4QTwmWWpNbnnVcjJ5WnuMNTZKXmp9q3CGKeScIJ4fKw7HaeU1rJqV0nxKV0zNJVu544D2JieyQ09lM3STghXN7PpK2dPEq/io5e691LToxvkqIjgvWHu7u4k6PeUWdD1FEbt3ZeXPfsukmanYEd8R9IYjw7mTp3XdRHlSkdzyKEb0ZinFHr2xvHJO11auK4VZIm6hkS+lUIwgyThBPC5b8mCWKi/+pnUNRrkqIjgvV/TRJ+vxo56KY0STghXDpJwslBmpOEE8LlW5xJwv5npXGWmqSsTRqdTpJGHrIqnKSsPRqdTpJGHrIqnKSsPRqdTpJGHrIqnKSsPRqdTpJGHrIqnKSsPRqdu/5/ElL3vuvAkzLznl2q6Nj7Tnjt+3b49gME/zbZt5fHQgAAAABJRU5ErkJggg=="
          />
          <image
            id="image1_2001_5114"
            width="102"
            height="95"
            preserveAspectRatio="none"
            xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGYAAABfCAYAAAAaqrIHAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAZqADAAQAAAABAAAAXwAAAAAtdscRAAAD2klEQVR4Ae2c0Y5iIQyGZzfe+I4+nu/o5W40+RJsZCgHKFX/vUEOpe35229gTGZ/fvRPCkgBvwJ//KbfZ3m73f553vp8Pk/X8a8nsGziFTjFh8wfEVIul4srWexnkiNiXNLHGw39bKRTbNozO8f6Xjnnfbyk2Fyu1+vj0Yz3FzFW3STzQ2dMq7NYn9E5SXQKT0PEhEvuC9hFDCS0fgazjr3I8RWjtBIxpRqJPqswiYpRpqLClGok+tx1xiTK25UKZ5w1foczT8TYqiWZbyWGjp7dwfjldmi1Zn12XBtnZC5iRtRbuHcLMXQsHc18tIPxg9+abqxjPxq3FmfkuYgZUW/h3lBi6FA6lvdiznrGDibXqFHERCndGUeF6RQsylyFiVK6M07oGdOZ28eZc4baF3t1pooYq1KSuYgJKASkcPu0IVkvyRExVqUkcxGzsBCQUCOF0KxjfydHxKBOslGFSVYQ0lFhUCLZqMIkKwjpqDAokWx8upVxKyDH8l7NM40xCoiYGJ27ozyIgRTu03jh+Sg5+MGvxrYCIqat0RaL072bLSlkwvOjHc9+/Gn0KyBi/FqFWj7dykIjF8Faf4kFsaNnXREy/UcRk7REW4nxksJZtYoc/GaqkYjJVI0il6XEQEQR7+lj7cyggyGFTcxZr+3HvjXir2W3Y13E7FDdEXMpMcQf7Wz8fNMoYpJWO4SYqHeHTM6gzGdISxMR01Jo0/pWYuhsOn1UA+uP+TuSI2JGu2HR/i3E2E5mfpQc9kMGc/wxZ32RllPdipipcs5zFkpMrXPpZNa9r4c9+9nHnHVLDna1kf219YjnIiZC5QMxQok5kN/ULZBTcwphtXXv814/fKdY5idivGoH230VMau17T2bXpFCjiIGJZKNImZDQX4jhXREDEokG13E9P7sTPaOadLxkEKyIgYlko2n+92Ze7fIGKsORNS8lL+n1Gx4LmJQItn4OGOopMiZUx30HPEmYkbUW7j36VZGpUXOQsWdrkWMU6hosydiCG7J4Tmjbm8osW4UMeu0HfL8khg8Qg5zzh7mvSP+8GPJs/Oa/5Ydv08Qr+Yn83MRk7Q6vxKzKmc6uUbO0bifQArvLmJQItm4hRg0OEoOZOCHEX/M33kUMUmrt5UYNKHTOXN43rp9sQ/7TxpFTNJqpirMnYBPpqCnB1IVpifxT7dVYZJWWIVRYZIqkDQtEaPCJFUgaVoiRoVJqkDStESMCpNUgYC07t8B2u8BW2FFTEuhTespvl3e9O7Lw0IJ35Iz93wfKGKWl+dYgMf/u+yp4DH3OXfZzmU+O1t0xT9zT5z/1PRbUlzhdEUAAAAASUVORK5CYII="
          />
          <image
            id="image2_2001_5114"
            width="93"
            height="62"
            preserveAspectRatio="none"
            xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF0AAAA+CAYAAABJERc3AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAXaADAAQAAAABAAAAPgAAAAAFXCZxAAACEklEQVR4Ae2Yy3LDIAxF3U42/kd/Xv7Ry7abzJg7uICRBE5OV5UAPY4118TLwh8EPoHA18gm933/OeZf13VoPcdaPP//9gxO7DwBoOe5uHqB7oo3H/yRd/t4VcO3bUsS6fq7ajyTnjz2GAPoMZyTLEBPcMQYoZpeaulTNJ5JL02CwzrQHaCWQgK9RMhh3VTT9Z7dW++7ajyT3jsZF84D/QK03iNA7yV44XzX92vVcNVgref5fKorsUvnk81/hsa7y7caJl2fZIAN9ADImgLoSiTAbrqnt2q4d/36DtD6ZtV4Jt17MjLxgZ6B4u0CujfhTPx/7+mqkaqhmXhNLr1ne8efReOZ9KYxsdkMdBuOTVGA3oTLZnNyT/fWcJuS66PoO0L7G6XxTHr9MzTbCXQzlPWBgF7Pymzn46hzqoFmWU4CRec7KSPczaSHI18WoAN9AIEBKZNvL0d996hlNg3Xbz/WPZ/9DkBerElXxAN6BSTrLUC3JloRL9H0iv1dW/SdMZvGdzWXOazvjJfGM+kZWN4uoHsTzsQHegaKtytU07WZu2m8arT2o/ZLw9XPpCuRABvoAZA1BdCVSIA9VNO1v7tpvNavmo+mK6GBNvIyAD7QB0CfStO1/9Earxqt9al9puG6j0lXIgE20AMgawqgK5EAe2pN1/5V43Xd267V7FIdTHqJkMM60B2glkICvUTIYf0XxnlwpM9IZXwAAAAASUVORK5CYII="
          />
          <image
            id="image3_2001_5114"
            width="97"
            height="68"
            preserveAspectRatio="none"
            xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGEAAABECAYAAACRZ1smAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAYaADAAQAAAABAAAARAAAAAAa1B3JAAACIElEQVR4Ae2bQY6DMAxFp6NuuAin4niciouwbMWu/FYkpE7slDdSpbECcfIf9leoevur/Leu6+MoxTAMt6PxK4z9X2GT0fcIhACEgBAAwt16DeoB0zQdptDrr+gRVMLhI9JmEAhtdD7MAoRDedoMfu0J2tNTHtBmW31loRIC8AJCBAjLsjy2T4C1XHYJpz3B2gPUQ3T+K5wbaEcB6g8IASDcx3G8/Ktkbw5JT9AerT289gY0v3W+CJ5DO7KmWjAfEApEs74FCNaKFsz3Zsrag1t7QMEevrplnufd/a09YtObStgh8AmA4KP7LisQdnL4BElPqL2saJ6jHlF7/5sHUQm1Vc6YHwgZItW+BAi1Fc6Y/80TMu4xvYRzCZ5g+kCVTkY7KlXO8D4gGIpZOpW7J+jCe/OIs+eKT++mqAR9ChxiIDiIrimBoIo4xMnvmB3W1FXK1LuvHM+gEgIgBwIQAigQYAl4wkkIOT3+dcpP54LX8e1/2pEq4hADwUF0TQkEVcQh/nlPONvDUwxyenxqDh2nElQRhxgIDqJrSiCoIg7xz3mCekCNHm7NiUqwVrRgPiAUiGZ9CxCsFS2Yr3tP6NEDlBOVoIo4xEBwEF1TAkEVcYiB4CC6pgSCKuIQA8FBdE0JBFXEIe7unPAL5wLlTCWoIg4xEBxE15RAUEUc4nC/T1AN9PcKPXw/oHtIxVRCSqEG40BoIHIqBRBSCjUYfwL9pF4mxh6p/wAAAABJRU5ErkJggg=="
          />
          <image
            id="image4_2001_5114"
            width="2404"
            height="28"
            preserveAspectRatio="none"
            xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAACWQAAAAcCAYAAADs3iR9AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAJZKADAAQAAAABAAAAHAAAAAAeGm2iAAAIFklEQVR4Ae3c4Y7bKhAG0LavuM+5z9hKt/pW2mnITQiOwZz+QY5tmDkMiVV5+fHDPwIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIzCfycKRixECBAgAABAgQIECBAgAABAgQIECBAgACBXoGPj4/fz977+fnp/8mfRXM9AQIECBAgQGAygdWfA1ePf7JyEA6BKQR+TRGFIAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIHABAX/5c4FJlAIBAgQIECBAgAABAgQIECBAgAABAgR2Fqg7Cjyy61XPPTsby50AAQIECBAgMKNAzzNdzz1H5d4TS889R8WvXwIE2gJ2yGrbOEOAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIGnBOyQ9RSXiwkQIECAAAECBAgQIECAAAECBAgQIEDgbIG6K0DieWRnrFybtvbV00f60hIgQIAAAQIECBwrUJ/dMlrPM1ztq6ePjP9oW8fMfT1j1756+sj4WgIExgvYIWu8qR4JECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIENhUwA5Zm068tAkQIECAAAECBAgQIECAAAECBAgQILCawJG7ANS+Y2OngUhoCRAgQIAAAQLnCdRntZHPaLXvZHnkGEf2fUT86VNLgMDjAnbIetzKlQQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIELgr8LVDVuutz7t3O0mAAAECBAgQIECAAAECBAgQIECAAAECBN4sMHJHgVbos/yf+TtyjcEsOSceLQECBAgQIECgCrzj2ejIZ6LV46/z4ZgAgX8Fss7tkPWvjU8IECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECDQJfC1Q1bX3W4iQIAAAQIECBAgQIAAAQIECBAgQIAAAQIEhgq0dmXIX1qPHOydY42MW18ECBAgQIAAAQIECBCYWcAOWTPPjtgIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIEFhKwA5ZS02XYAkQIECAAAECBAgQIECAAAECBAgQIEBgJ4HWDlZHGByxA9cRceqTAAECBAgQIECAAAECswvYIWv2GRIfAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQLLCNgha5mpuh1o66+j/CXTbS+fXkugVf/J0jqIhPYZgVZdqadnFF1LYC2B1rpPFtZ/JLQECBAgsLKA37uVZ2/92Fv15zlr/bmVwf8LtOo/d1oHkdA+I9CqK/X0jKJrCawl0Fr3ycL6j4SWAAECBFYWuNrvnR2yVq5GsRMgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgMJVA9w5ZV3szbapZEUxTIHV39pv+iSOBnh1P4tDuIaD+/s5zHHZbf7vmvcfqPi/L1FUi2G1dJe9X2zjO5pe4an6zxVnjc/xdwDx+97jKkXk9dybj3/o+zPlE2bou519t63jp7+hxM85V25Zr8uUbCe1IgdTd2fWVOJLb2fEkDu0eAurv7zzHYbf1t2vee6zu87JMXSWC3dZV8n61jeNsfomr5jdbnDU+x98FzON3j6scmddzZzL+re/DnE+Urety/tW2jpf+jh4346zW2iFrtRkTLwECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAEC0wp075A1bUYCI0CAAAECbxDIG+De+H4D9oJDqI8FJ03Iywtk3SUR38+R0L5TIHW4av0l/mq2aj41D8cECBAgQIAAgd0E8nzneW63mX8sX/XxmJOrCIwUyLpLn76fI6F9p0DqcNX6S/zVbNV8ah6OryVgh6xrzadsCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBA4UcAOWYPx80bm1d/ATJ7hmy3fGl/iTDtbvIlr9ba6c+6b0TiO8kt/NZpR/dd+HV9bIPXUqp+cj0Lrupwf3dbx0/+748i4WgIECBC4LVC/r31P33byKYEegawv66pHb597dqmT5JmZnW1d1PgSZ9rZ4k1cq7fVnXPfjMZxlF/6q9GM6r/26/jaAqmnVv3kfBRa1+X86LaOn/7fHUfG1RIgQIDAbYH6fe17+raTTwn0CGR9XX1d2SGrpzrcQ4AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAgRsCXztk5Q20G9f899HoN9PqeKP7b+Ux6+fVo8a5u0/1cHxfIPWkbu47OUuAAAEC5wjkd6qO7nerijg+UqBVhxnz1XpM/6/2k3i0BFYSSP0nZusgEnu0mf+j5j39tzRHj1vHG91/K49ZP68eNc7dfaqH4/sCqSd1c9/JWQIECBA4RyC/U3V0v1tVxPGRAq06zJiv1mP6f7WfxKMlsJJA6j8xWweR2KPN/B8973bI2qOeZEmAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAEC2wn8AZsK1DTqfB3rAAAAAElFTkSuQmCC"
          />
          <image
            id="image5_2001_5114"
            width="97"
            height="101"
            preserveAspectRatio="none"
            xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGEAAABlCAYAAABdl421AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAYaADAAQAAAABAAAAZQAAAADmdRt9AAADgUlEQVR4Ae2dSXLjMAxF01298UV8IW99PG99IV/Ey7SjKlVKv6iAI0A5L5uEE0C+LxCi5CQfH3xBAAIQgAAEIAABCHwT+PP943F+ej6fnzPP9nQ6FXH9O/Nifsvc/h1hodaVf71eQ5dxu92a/BMJTfj6DEaEPhybrCBCE74+g4uyeB+X5VY0J0TnAGsFmiOsuyUiwSLq0H6Iu6NSDvf7fRPhl8tl6nMFkVCq8ID+iDAAaqlJRCglNqD/W+aE2XOA6kgkKJGAMiIEQFeXiKBEAsqIEABdXSKCEgkoI0IAdHX5lreousjZyo/HY/MYhUiYQCEiwVEEjYDz+bw8aCQSHEXYc0Uk7JEZUL9e+WoaEV5E9E2YQhpdZjsaTTjDPiJkQBrdBRFGE86wv3kXu/bXTzes9et369MDa7/a75b/6E9baA5p5UEk1F4pHcchQkeYtaYQoZZcx3HLOUH3YN1zdQ/s5V/97tnV+ez1y60ftZ5c/9qPSFAiAWVECICuLhFBiQSUXZ4dRe39vXi2ngOseRAJFiGHdkRwgGy5QASLkEN7Vk7Q+/TcPX5v/mpvr9+oesu/9zmCSBildIFdRCiANaorIowiW2A3KyeoPd1TrT1U+6s977LON3p+RIL3FZDwhwgJKN5ViOBNPOGvKieoneg9VedTWtYcUTq+tT+R0Eqww3hE6ACx1QQitBLsML5LTugwj1ATo98XWIsjEixCDu2I4ADZcoEIFiGH9iUn6J6o7wuOfg5w4Njkgkhowtdn8K+4O9ITsUZ+H5T1VoiEenbdRiYjQa8UckQ33klDREISi28lIvjyTnpDhCQW38rk76xZU5g9R+jdkK5Hc562e5eJBG/iCX+IkIDiXYUI3sQT/qpygtqJzhFHywHKj0hQIgFlRAiAri4RQYkElJPPjlrnoXt06fuI1vGt8/ceTyR4E0/4WyLhaH9lPbGOH6ui16f/2UQnSyQokYDyEgmWUta8XuM3XfTcsGlMFDQH6LMdtWflGB2fcDlVFZEwgRyIgAgTEJhgCkPOCda6rBxgjX+3drajCRStioTo++4JuHWdApHQFWedsapIsM4Vrz1/808adGp6n6/ngNL7/N72dL6jy0TCaMIZ9hEhA1Jul69cWZMvESGX8MB+yztmSz0rB+j8dI/XdqusOaG3Pcu/dzuR4E0cfxCAAAQgAAEIzE3gP2lpq/3Ggi5LAAAAAElFTkSuQmCC"
          />
        </defs>
      </svg>
    </div>
  );
};
